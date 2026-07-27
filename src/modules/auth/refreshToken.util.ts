import crypto from 'crypto';
import { env } from '../../config/env';

/**
 * Refresh tokens are opaque random strings, not JWTs. Only a SHA-256 hash
 * is ever stored in the DB — same principle as password hashing — so a DB
 * leak alone can't be used to forge a valid refresh token.
 */
export function generateRawRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

export function hashRefreshToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function refreshTokenExpiryDate(): Date {
  return new Date(Date.now() + env.jwt.refreshExpiresInDays * 24 * 60 * 60 * 1000);
}