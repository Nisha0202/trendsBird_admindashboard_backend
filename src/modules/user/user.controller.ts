import { Request, Response } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import { sendSuccess } from '../../common/ApiResponse';
import * as userService from './user.service';

export const createUserHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await userService.createUser(req.body), 201);
});

export const listUsersHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.listUsers(req.query as any);
  sendSuccess(res, result.users, 200, { pagination: result.pagination });
});

export const getUserHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await userService.getUserById(req.params.id as string), 200);
});

export const updateUserHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await userService.updateUser(req.params.id as string, req.body, req.user!.id), 200);
});

export const deleteUserHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await userService.deleteUser(req.params.id as string, req.user!.id), 200);
});