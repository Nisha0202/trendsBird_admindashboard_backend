import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../common/ApiError';
import { verifyAccessToken } from '../modules/auth/jwt.util';
import { prisma } from '../config/prisma';

/**
 * Registered GLOBALLY in app.ts so every new route is protected by default.
 * Public routes are an explicit, auditable opt-out list below — there is
 * no per-route opt-in, so nobody can forget to protect a new route.
 */
const PUBLIC_ROUTES: { method: string; path: string }[] = [
  { method: 'POST', path: '/api/v1/auth/login' },
  { method: 'POST', path: '/api/v1/auth/refresh' },
  { method: 'POST', path: '/api/v1/auth/logout' },
  { method: 'GET', path: '/health' },
];

function isPublicRoute(req: Request): boolean {
  return PUBLIC_ROUTES.some((r) => r.method === req.method && req.path === r.path);
}

export async function authGuard(req: Request, _res: Response, next: NextFunction) {
  if (isPublicRoute(req)) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Missing or malformed access token'));
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return next(ApiError.unauthorized('Missing access token'));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(ApiError.unauthorized('Invalid or expired access token'));
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });

  if (!user || !user.active) {
    return next(ApiError.unauthorized('Account is inactive or no longer exists'));
  }

  req.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    roleId: user.role.id,
    roleName: user.role.name,
    permissions: user.role.permissions.map((rp) => rp.permission.name),
  };

  next();
}

import rateLimit from 'express-rate-limit';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 5, // Limit each IP to 5 login requests per windowMs
  skipSuccessfulRequests: true,
  message: {
    statusCode: 429,
    message: 'Too many failed login attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});