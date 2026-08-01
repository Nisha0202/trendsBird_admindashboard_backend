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

  // 2. Handle Prisma known request errors without importing Prisma
if (err.code === 'P2002') {
  const fields =
    err.meta?.target ??
    err.meta?.driverAdapterError?.cause?.constraint?.fields;

  const target = Array.isArray(fields)
    ? fields.join(', ')
    : fields;

  const messages: Record<string, string> = {
    sku: 'A product with this SKU already exists',
    slug: 'A product with this slug already exists',
    name: 'A product with this name already exists',
  };

  return res.status(409).json({
    success: false,
    message: messages[target as string] ?? `Duplicate value provided for: ${target ?? 'field'}`,
  });
}

  // 3. Fallback: Log stack trace server-side and return generic 500
  console.error(err);
  return res.status(500).json({ success: false, message: 'Internal server error' });
}