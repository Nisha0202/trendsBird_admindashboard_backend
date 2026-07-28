import slugify from 'slugify';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';
import {
  CreatePermissionGroupInput,
  UpdatePermissionGroupInput,
  ListPermissionsQuery,
} from './permission.schema';

function groupSlug(name: string): string {
  return slugify(name, { lower: true, strict: true, replacement: '_' });
}

function buildPermissionName(groupName: string, action: string): string {
  return `${groupSlug(groupName)}:${action}`;
}

export async function createGroupWithActions(input: CreatePermissionGroupInput) {
  const existing = await prisma.permissionGroup.findUnique({ where: { name: input.name } });
  if (existing) throw ApiError.conflict(`Permission group "${input.name}" already exists`);

  const uniqueActions = [...new Set(input.actions)];

  return prisma.$transaction(async (tx) => {
    const group = await tx.permissionGroup.create({
      data: { name: input.name, description: input.description ?? null},
    });

    const permissions = await Promise.all(
      uniqueActions.map((action) =>
        tx.permission.create({
          data: { name: buildPermissionName(input.name, action), groupId: group.id },
        })
      )
    );

    return { ...group, permissions };
  });
}

// export async function listGroups(query: ListPermissionsQuery) {
//   const { search, page, limit } = query;

//   const where = search
//     ? {
//         OR: [
//           { name: { contains: search, mode: 'insensitive' as const } },
//           { permissions: { some: { name: { contains: search, mode: 'insensitive' as const } } } },
//         ],
//       }
//     : {};

//   const [groups, total] = await prisma.$transaction([
//     prisma.permissionGroup.findMany({
//       where,
//       include: { permissions: { orderBy: { name: 'asc' } } },
//       orderBy: { name: 'asc' },
//       skip: (page - 1) * limit,
//       take: limit,
//     }),
//     prisma.permissionGroup.count({ where }),
//   ]);

//   return { groups, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
// }

export async function listGroups(query: ListPermissionsQuery) {
  // Provide defaults so skip/take never receive NaN or undefined
  const search = query.search;
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { permissions: { some: { name: { contains: search, mode: 'insensitive' as const } } } },
        ],
      }
    : {};

  const [groups, total] = await prisma.$transaction([
    prisma.permissionGroup.findMany({
      where,
      include: { permissions: { orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.permissionGroup.count({ where }),
  ]);

  return { groups, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getGroupById(id: string) {
  const group = await prisma.permissionGroup.findUnique({
    where: { id },
    include: { permissions: { orderBy: { name: 'asc' } } },
  });
  if (!group) throw ApiError.notFound('Permission group not found');
  return group;
}

export async function updateGroup(id: string, input: UpdatePermissionGroupInput) {
  const group = await prisma.permissionGroup.findUnique({ where: { id } });
  if (!group) throw ApiError.notFound('Permission group not found');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.permissionGroup.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });

    if (input.addActions?.length) {
      const uniqueActions = [...new Set(input.addActions)];
      await Promise.all(
        uniqueActions.map((action) =>
          tx.permission.create({
            data: { name: buildPermissionName(updated.name, action), groupId: updated.id },
          })
        )
      );
    }

    if (input.removePermissionIds?.length) {
      // Design decision (see README): deleting/removing a permission CASCADES
      // its role links (RolePermission.onDelete: Cascade in schema.prisma)
      // rather than refusing the removal while a role still holds it.
      await tx.permission.deleteMany({
        where: { id: { in: input.removePermissionIds }, groupId: updated.id },
      });
    }

    return tx.permissionGroup.findUnique({
      where: { id },
      include: { permissions: { orderBy: { name: 'asc' } } },
    });
  });
}

export async function deletePermission(id: string) {
  const permission = await prisma.permission.findUnique({ where: { id } });
  if (!permission) throw ApiError.notFound('Permission not found');

  await prisma.permission.delete({ where: { id } }); // cascades role_permissions rows
  return { deleted: true };
}