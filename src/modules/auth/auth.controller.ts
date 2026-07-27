import { Request, Response } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import { sendSuccess } from '../../common/ApiResponse';
import * as authService from './auth.service';

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  sendSuccess(res, result, 200);
});

export const sessionHandler = asyncHandler(async (req: Request, res: Response) => {
  // authGuard has already populated req.user before this runs.
  sendSuccess(res, authService.getSession(req.user!), 200);
});


export const refreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.refresh(req.body);
  sendSuccess(res, result, 200);
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.logout(req.body);
  sendSuccess(res, result, 200);
});