import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { sendSuccess } from '../../common/ApiResponse';
import { validate } from '../../middleware/validate';
import { ApiError } from '../../common/ApiError';

const router = Router();

const echoSchema = z.object({
  name: z.string().min(2, 'name must be at least 2 characters'),
  age: z.number().int().positive('age must be a positive integer'),
});

// Proves: validate() + asyncHandler() + sendSuccess() all work together.
router.post(
  '/echo',
  validate(echoSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(res, { received: req.body }, 200);
  })
);

// Proves: asyncHandler correctly forwards a thrown ApiError to errorHandler.
router.get(
  '/boom',
  asyncHandler(async () => {
    throw ApiError.conflict('This is a deliberate test conflict', { reason: 'testing errorHandler' });
  })
);

export default router;