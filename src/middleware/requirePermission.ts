
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../common/ApiError';

/**
 * Declares the permission(s) a route needs, e.g.:
 *   router.delete('/:id', requirePermission('product:delete'), controller.remove)
 * Must run AFTER authGuard. 403 only — 401 is exclusively authGuard's job.
 */
export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Not authenticated'));
    }
    const hasAll = permissions.every((p) => req.user!.permissions.includes(p));
    if (!hasAll) {
      return next(ApiError.forbidden(`Missing required permission(s): ${permissions.join(', ')}`));
    }
    next();
  };
}