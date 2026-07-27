import { z } from 'zod';

const actionNameSchema = z
  .string()
  .trim()
  .min(1, 'Action name is required')
  .transform((val) => val.toLowerCase().replace(/\s+/g, '_'));

export const createPermissionGroupSchema = z.object({
  name: z.string().trim().min(2, 'Group name must be at least 2 characters'),
  description: z.string().trim().optional(),
  actions: z.array(actionNameSchema).min(1, 'At least one action is required'),
});

export const updatePermissionGroupSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().optional(),
  addActions: z.array(actionNameSchema).optional(),
  removePermissionIds: z.array(z.string().uuid()).optional(),
});

export const listPermissionsQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

export type CreatePermissionGroupInput = z.infer<typeof createPermissionGroupSchema>;
export type UpdatePermissionGroupInput = z.infer<typeof updatePermissionGroupSchema>;
export type ListPermissionsQuery = z.infer<typeof listPermissionsQuerySchema>;