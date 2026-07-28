import { z } from 'zod';

export const createBrandSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  logoId: z.string().uuid().optional(),
  status: z.boolean().default(true),
  description: z.string().trim().optional(),
});

export const updateBrandSchema = z.object({
  name: z.string().trim().min(2).optional(),
  logoId: z.string().uuid().nullable().optional(),
  status: z.boolean().optional(),
  description: z.string().trim().optional(),
});

export const listBrandsQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
export type ListBrandsQuery = z.infer<typeof listBrandsQuerySchema>;