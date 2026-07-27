import bcrypt from 'bcrypt';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';
import { LoginInput } from './auth.schema';
import { signAccessToken } from './jwt.util';
import { generateRawRefreshToken, hashRefreshToken, refreshTokenExpiryDate } from './refreshToken.util';

// Same generic error for a wrong email and a wrong password — never
// reveal which one was incorrect.
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user) {
    throw ApiError.unauthorized(INVALID_CREDENTIALS_MESSAGE);
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw ApiError.unauthorized(INVALID_CREDENTIALS_MESSAGE);
  }

  if (!user.active) {
    // Deliberately still generic — do not confirm to an attacker that this
    // specific email exists but is deactivated.
    throw ApiError.unauthorized(INVALID_CREDENTIALS_MESSAGE);
  }

  const accessToken = signAccessToken({ sub: user.id });

  const rawRefreshToken = generateRawRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(rawRefreshToken),
      expiresAt: refreshTokenExpiryDate(),
    },
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  };
}

import { AuthenticatedUser } from '../../types/express';

export function getSession(user: AuthenticatedUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: { id: user.roleId, name: user.roleName },
    permissions: user.permissions,
  };
}

import { RefreshInput, LogoutInput } from './auth.schema';


export async function refresh(input: RefreshInput) {
  const tokenHash = hashRefreshToken(input.refreshToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored) {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  // Reuse detection: this exact token was already rotated away once before.
  // Someone presenting it again means it was likely stolen — kill every
  // active session for this user as a precaution.
  if (stored.revoked) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
    throw ApiError.unauthorized('Refresh token reuse detected — all sessions revoked');
  }

  if (stored.expiresAt < new Date()) {
    throw ApiError.unauthorized('Refresh token expired');
  }

  if (!stored.user.active) {
    throw ApiError.unauthorized('Account is inactive');
  }

  const newRawToken = generateRawRefreshToken();
  const newTokenHash = hashRefreshToken(newRawToken);

  // Rotate: old token is marked used/revoked and linked to its replacement,
  // a brand new refresh token row is created.
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true, revokedAt: new Date(), replacedByHash: newTokenHash },
    }),
    prisma.refreshToken.create({
      data: {
        userId: stored.userId,
        tokenHash: newTokenHash,
        expiresAt: refreshTokenExpiryDate(),
      },
    }),
  ]);

  const accessToken = signAccessToken({ sub: stored.userId });

  return { accessToken, refreshToken: newRawToken };
}

export async function logout(input: LogoutInput) {
  const tokenHash = hashRefreshToken(input.refreshToken);

  // Idempotent: whether or not the token exists, the end state the caller
  // wants (this refresh token can never be used again) is already true.
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revoked: false },
    data: { revoked: true, revokedAt: new Date() },
  });

  return { loggedOut: true };
}