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