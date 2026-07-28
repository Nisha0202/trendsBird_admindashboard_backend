import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z.string().trim().min(2, 'Role name must be at least 2 characters'),
  description: z.string().trim().optional(),
  status: z.boolean().default(true),
  permissionIds: z.array(z.string().uuid()).optional(),
  grantAll: z.boolean().default(false), // shortcut for building an administrator role
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().optional(),
  status: z.boolean().optional(),
  addPermissionIds: z.array(z.string().uuid()).optional(),
  removePermissionIds: z.array(z.string().uuid()).optional(),
  grantAll: z.boolean().optional(),
});

export const listRolesQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type ListRolesQuery = z.infer<typeof listRolesQuerySchema>;