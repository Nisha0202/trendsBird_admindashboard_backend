import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';
import { CreateRoleInput, UpdateRoleInput, ListRolesQuery } from './role.schema';

const GUARD_PERMISSION_NAME = 'role:update';

async function assertRoleManagementSurvives(roleIdBeingChanged: string, willStillHaveIt: boolean) {
  if (willStillHaveIt) return;

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
  const { search, status } = query;

  // Safely parse page & limit to numbers with sensible fallbacks
  const pageParam = typeof query.page === 'string' ? parseInt(query.page, 10) : Number(query.page);
  const limitParam = typeof query.limit === 'string' ? parseInt(query.limit, 10) : Number(query.limit);

  const page = !isNaN(pageParam) && pageParam > 0 ? pageParam : 1;
  const limit = !isNaN(limitParam) && limitParam > 0 ? limitParam : 10;

  const skip = (page - 1) * limit;

  const where = {
    ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    ...(status !== undefined ? { status } : {}),
  };

  const [roles, total] = await prisma.$transaction([
    prisma.role.findMany({
      where,
      include: {
        _count: {
          select: {
            users: {
              where: { deletedAt: null }, // Only count ACTIVE users in role list
            },
            permissions: true, // Counts total permissions assigned to each role
          },
        },
      },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.role.count({ where }),
  ]);

  return { roles, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getRoleById(id: string) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      permissions: { include: { permission: true } },
      _count: {
        select: {
          users: {
            where: { deletedAt: null }, // Only count ACTIVE users
          },
          permissions: true,
        },
      },
    },
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
    ((input.removePermissionIds?.includes(guardPermission.id) ?? false) || input.status === false);

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
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw ApiError.notFound('Role not found');

  // Check if any ACTIVE (non-deleted) users hold this role
  const activeUserCount = await prisma.user.count({
    where: {
      roleId: id,
      deletedAt: null,
    },
  });

  if (activeUserCount > 0) {
    throw ApiError.conflict(`Cannot delete role "${role.name}" — ${activeUserCount} active user(s) still hold it`);
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

  return prisma.$transaction(async (tx) => {
    // 1. Delete or unassign soft-deleted users linked to this role so foreign key constraint passes
    await tx.user.deleteMany({
      where: {
        roleId: id,
        deletedAt: { not: null },
      },
    });

    // 2. Delete role-permission relations
    await tx.rolePermission.deleteMany({
      where: { roleId: id },
    });

    // 3. Delete the role itself
    await tx.role.delete({ where: { id } });

    return { deleted: true };
  });
}