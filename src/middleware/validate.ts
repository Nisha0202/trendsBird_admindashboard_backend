import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ApiError } from '../common/ApiError';

type Target = 'body' | 'query' | 'params';

/**
 * Validates req[target] against a zod schema. On failure -> 422 with
 * per-field messages so the frontend can attach errors to the right inputs.
 * On success, req[target] is replaced with the parsed/coerced value.
 */
export function validate(schema: ZodSchema, target: Target = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(ApiError.unprocessable('Validation failed', details));
    }

    if (target === 'query') {
      // req.query is read-only in Express/Node; clear old keys and copy coerced Zod values
      for (const key of Object.keys(req.query)) {
        delete (req.query as Record<string, any>)[key];
      }
      Object.assign(req.query, result.data);
    } else {
      req[target] = result.data;
    }

    next();
  };
}