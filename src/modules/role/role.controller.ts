import { Request, Response } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import { sendSuccess } from '../../common/ApiResponse';
import * as roleService from './role.service';

export const createRoleHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await roleService.createRole(req.body), 201);
});

export const listRolesHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await roleService.listRoles(req.query as any);
  sendSuccess(res, result.roles, 200, { pagination: result.pagination });
});

export const getRoleHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await roleService.getRoleById(req.params.id as string), 200);
});

export const updateRoleHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await roleService.updateRole(req.params.id as string, req.body), 200);
});

export const deleteRoleHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await roleService.deleteRole(req.params.id as string), 200);
});