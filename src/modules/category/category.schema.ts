import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  description: z.string().trim().optional(),
  imageId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().optional(),
  imageId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;