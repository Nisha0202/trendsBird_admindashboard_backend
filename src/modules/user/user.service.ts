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
  const { search, roleId, active, page, limit } = query;

  const where = {
    deletedAt: null,
    ...(roleId ? { roleId } : {}),
    ...(active !== undefined ? { active } : {}),
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
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users: users.map(toSafeUser), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, include: { role: true } });
  if (!user) throw ApiError.notFound('User not found');
  return toSafeUser(user);
}

export async function updateUser(id: string, input: UpdateUserInput, requesterId: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw ApiError.notFound('User not found');

  // Self-escalation prevention: a user can never change their own role,
  // regardless of what value is sent — including "no-op" changes to the
  // same roleId, since that still confirms/reinforces self-granted access.
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

  // If deactivating, kill all outstanding refresh tokens immediately —
  // don't wait for them to try (and fail) to refresh.
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