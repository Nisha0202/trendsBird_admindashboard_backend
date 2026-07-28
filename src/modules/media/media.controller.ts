import { Request, Response } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import { sendSuccess } from '../../common/ApiResponse';
import { ApiError } from '../../common/ApiError';
import * as mediaService from './media.service';

export const uploadHandler = asyncHandler(async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[]) ?? (req.file ? [req.file] : []);
  if (files.length === 0) throw ApiError.badRequest('No file(s) provided');

  const result = await mediaService.uploadFiles(files, req.user!.id);
  sendSuccess(res, result, 201);
});

export const listMediaHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await mediaService.listMedia(req.query as any);
  sendSuccess(res, result.media, 200, { pagination: result.pagination });
});

export const updateMediaHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await mediaService.updateMedia(req.params.id as string, req.body), 200);
});

export const deleteMediaHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await mediaService.deleteMedia(req.params.id as string), 200);
});