import bcrypt from 'bcrypt';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';
import { CreateUserInput, UpdateUserInput, ListUsersQuery } from './user.schema';

function toSafeUser<T extends { passwordHash?: string }>(user: T) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export async function createUser(input: CreateUserInput) {
  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw ApiError.badRequest('roleId does not reference an existing role');

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      phone: input.phone ?? null,
      gender: input.gender ?? null,
      roleId: input.roleId,
      active: input.active,
    },
    include: { role: true },
  });

  return toSafeUser(user);
}

export async function listUsers(query: ListUsersQuery) {
  const { search, roleId, active, page = 1, limit = 10 } = query;

  // 1. Safely normalize boolean types (handles string "true"/"false" or boolean primitives)
  let activeBool: boolean | undefined = undefined;
  if (typeof active === 'boolean') {
    activeBool = active;
  } else if (typeof active === 'string') {
    if (active === 'true') activeBool = true;
    if (active === 'false') activeBool = false;
  }

  // 2. Safely normalize numbers for pagination
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 10);
  const skip = (pageNum - 1) * limitNum;

  const where = {
    deletedAt: null,
    ...(roleId ? { roleId } : {}),
    ...(activeBool !== undefined ? { active: activeBool } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      include: { role: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map(toSafeUser),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, include: { role: true } });
  if (!user) throw ApiError.notFound('User not found');
  return toSafeUser(user);
}

export async function updateUser(id: string, input: UpdateUserInput, requesterId: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw ApiError.notFound('User not found');

  if (id === requesterId && input.roleId !== undefined) {
    throw ApiError.forbidden('You cannot change your own role');
  }

  if (input.roleId) {
    const role = await prisma.role.findUnique({ where: { id: input.roleId } });
    if (!role) throw ApiError.badRequest('roleId does not reference an existing role');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.email ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.gender !== undefined ? { gender: input.gender } : {}),
      ...(input.roleId ? { roleId: input.roleId } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
    include: { role: true },
  });

  if (input.active === false) {
    await prisma.refreshToken.updateMany({
      where: { userId: id, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
  }

  return toSafeUser(updated);
}

export async function deleteUser(id: string, requesterId: string) {
  if (id === requesterId) {
    throw ApiError.badRequest('You cannot delete your own account');
  }

  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw ApiError.notFound('User not found');

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { deletedAt: new Date(), active: false } }),
    prisma.refreshToken.updateMany({
      where: { userId: id, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    }),
  ]);

  return { deleted: true };
}