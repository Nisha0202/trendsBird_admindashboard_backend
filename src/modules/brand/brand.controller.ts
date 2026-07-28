import { Request, Response } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import { sendSuccess } from '../../common/ApiResponse';
import * as brandService from './brand.service';
import { listBrandsQuerySchema } from './brand.schema';

export const createBrandHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await brandService.createBrand(req.body), 201);
});



export const listBrandsHandler = asyncHandler(async (req: Request, res: Response) => {
  // Parse query using schema to ensure Zod coerces status to boolean and page/limit to numbers
  const query = listBrandsQuerySchema.parse(req.query);
  const result = await brandService.listBrands(query);
  sendSuccess(res, result.brands, 200, { pagination: result.pagination });
});

export const getBrandHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await brandService.getBrandById(req.params.id as string), 200);
});

export const updateBrandHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await brandService.updateBrand(req.params.id as string, req.body), 200);
});

export const deleteBrandHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await brandService.deleteBrand(req.params.id as string), 200);
});