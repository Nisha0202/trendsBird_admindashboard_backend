import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../common/ApiError';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // 1. Handle Custom API Errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // 2. Safely check for Prisma Known Request Errors without importing Prisma
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    // P2002: Unique constraint violation (e.g. duplicate email, slug, SKU)
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target)
        ? err.meta.target.join(', ')
        : err.meta?.target ?? 'field';
      return res.status(409).json({
        success: false,
        message: `Duplicate value provided for: ${target}`,
      });
    }

    // P2025: Record not found
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Record not found',
      });
    }

    // P2003: Foreign key constraint failure
    if (err.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: 'Operation violates a foreign key relationship',
      });
    }
  }

  // 3. Fallback: Log stack trace server-side and return generic 500
  console.error(err);
  return res.status(500).json({ success: false, message: 'Internal server error' });
}