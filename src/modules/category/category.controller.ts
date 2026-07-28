import { Request, Response } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import { sendSuccess } from '../../common/ApiResponse';
import * as categoryService from './category.service';

export const createCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await categoryService.createCategory(req.body), 201);
});

export const getTreeHandler = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await categoryService.getCategoryTree(), 200);
});

export const getCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await categoryService.getCategoryById(req.params.id as string), 200);
});

export const updateCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await categoryService.updateCategory(req.params.id as string, req.body), 200);
});

export const deleteCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await categoryService.deleteCategory(req.params.id as string), 200);
});