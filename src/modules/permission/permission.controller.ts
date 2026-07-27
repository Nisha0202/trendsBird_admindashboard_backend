import { Request, Response } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import { sendSuccess } from '../../common/ApiResponse';
import * as permissionService from './permission.service';

export const createGroupHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await permissionService.createGroupWithActions(req.body);
  sendSuccess(res, result, 201);
});

export const listGroupsHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await permissionService.listGroups(req.query as any);
  sendSuccess(res, result.groups, 200, { pagination: result.pagination });
});


export const getGroupHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await permissionService.getGroupById(req.params.id as string);
  sendSuccess(res, result, 200);
});

export const updateGroupHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await permissionService.updateGroup(req.params.id as string, req.body);
  sendSuccess(res, result, 200);
});

export const deletePermissionHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await permissionService.deletePermission(req.params.id as string);
  sendSuccess(res, result, 200);
});