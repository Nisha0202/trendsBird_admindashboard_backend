import { z } from 'zod';

export const listMediaQuerySchema = z.object({
  search: z.string().trim().optional(),
  type: z.enum(['IMAGE', 'VIDEO']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const updateMediaSchema = z.object({
  altText: z.string().trim().optional(),
  title: z.string().trim().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });

export type ListMediaQuery = z.infer<typeof listMediaQuerySchema>;
export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;