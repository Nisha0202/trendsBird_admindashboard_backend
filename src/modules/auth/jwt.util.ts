import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

/**
 * Deliberately minimal payload: just WHO (sub = userId), nothing about role
 * or permissions. Those get looked up fresh from the DB on every request
 * (task 11's authGuard), so a permission/role change takes effect on the
 * user's very next request instead of waiting for token expiry.
 */
export interface AccessTokenPayload {
  sub: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: '15m' });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as unknown as AccessTokenPayload;
}