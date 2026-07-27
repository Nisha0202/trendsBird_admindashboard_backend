import { Response } from 'express';

/** One consistent success shape across the whole API. */
export function sendSuccess(
  res: Response,
  data: unknown,
  statusCode = 200,
  meta?: Record<string, unknown>
) {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  });
}