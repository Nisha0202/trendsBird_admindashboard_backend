import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';
import { CreateRoleInput, UpdateRoleInput, ListRolesQuery } from './role.schema';

const GUARD_PERMISSION_NAME = 'role:update';

/**
 * Ensures at least one active role would still hold `role:update` after the
 * pending change. Called before any update/delete that could remove it —
 * a small guard, but it stops an admin from locking everyone out of Role
 * management by accident.
 */
async function assertRoleManagementSurvives(roleIdBeingChanged: string, willStillHaveIt: boolean) {
  if (willStillHaveIt) return; // this role keeps the permission, nothing to check

  const otherRolesWithIt = await prisma.role.count({
    where: {
      id: { not: roleIdBeingChanged },
      status: true,
      permissions: { some: { permission: { name: GUARD_PERMISSION_NAME } } },
    },
  });

  if (otherRolesWithIt === 0) {
    throw ApiError.badRequest(
      `Cannot proceed: this would leave no active role holding "${GUARD_PERMISSION_NAME}", meaning nobody could manage roles anymore.`
    );
  }
}

export async function createRole(input: CreateRoleInput) {
  const existing = await prisma.role.findUnique({ where: { name: input.name } });
  if (existing) throw ApiError.conflict(`Role "${input.name}" already exists`);

  let permissionIds = input.permissionIds ?? [];

  if (input.grantAll) {
    const all = await prisma.permission.findMany({ select: { id: true } });
    permissionIds = all.map((p) => p.id);
  }

  if (permissionIds.length) {
    const found = await prisma.permission.findMany({ where: { id: { in: permissionIds } } });
    if (found.length !== permissionIds.length) {
      throw ApiError.badRequest('One or more permissionIds do not exist');
    }
  }

 return prisma.role.create({
  data: {
    name: input.name,
    description: input.description ?? null,
    status: input.status,
    permissions: {
      create: permissionIds.map((permissionId) => ({
        permissionId,
      })),
    },
  },
  include: {
    permissions: {
      include: {
        permission: true,
      },
    },
  },
});







}

export async function listRoles(query: ListRolesQuery) {
  const { search, status, page, limit } = query;

  const where = {
    ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    ...(status !== undefined ? { status } : {}),
  };

  const [roles, total] = await prisma.$transaction([
    prisma.role.findMany({
      where,
      include: { _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.role.count({ where }),
  ]);

  return { roles, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getRoleById(id: string) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
  });
  if (!role) throw ApiError.notFound('Role not found');
  return role;
}

export async function updateRole(id: string, input: UpdateRoleInput) {
  const role = await getRoleById(id);

  const guardPermission = await prisma.permission.findUnique({ where: { name: GUARD_PERMISSION_NAME } });
  const currentlyHasGuard = role.permissions.some((rp) => rp.permission.name === GUARD_PERMISSION_NAME);
  const willRemoveGuard =
    guardPermission != null &&
    ((input.removePermissionIds?.includes(guardPermission.id) ?? false) ||
      input.status === false);

  const willStillHaveIt = currentlyHasGuard && !willRemoveGuard;

  if (currentlyHasGuard) {
    await assertRoleManagementSurvives(id, willStillHaveIt);
  }

  return prisma.$transaction(async (tx) => {
    await tx.role.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });

    if (input.grantAll) {
      const all = await tx.permission.findMany({ select: { id: true } });
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({
        data: all.map((p) => ({ roleId: id, permissionId: p.id })),
        skipDuplicates: true,
      });
    } else {
      if (input.addPermissionIds?.length) {
        await tx.rolePermission.createMany({
          data: input.addPermissionIds.map((permissionId) => ({ roleId: id, permissionId })),
          skipDuplicates: true,
        });
      }
      if (input.removePermissionIds?.length) {
        await tx.rolePermission.deleteMany({
          where: { roleId: id, permissionId: { in: input.removePermissionIds } },
        });
      }
    }

    return tx.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
  });
}

export async function deleteRole(id: string) {
  const role = await prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!role) throw ApiError.notFound('Role not found');

  if (role._count.users > 0) {
    throw ApiError.conflict(`Cannot delete role "${role.name}" — ${role._count.users} user(s) still hold it`);
  }

  const guardPermission = await prisma.permission.findUnique({ where: { name: GUARD_PERMISSION_NAME } });
  const hasGuard = guardPermission
    ? await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: id, permissionId: guardPermission.id } },
      })
    : null;

  if (hasGuard) {
    await assertRoleManagementSurvives(id, false);
  }

  await prisma.role.delete({ where: { id } });
  return { deleted: true };
}