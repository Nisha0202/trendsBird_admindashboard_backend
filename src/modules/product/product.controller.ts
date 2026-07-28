import { Request, Response } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import { sendSuccess } from '../../common/ApiResponse';
import * as productService from './product.service';

export const createProductHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await productService.createProduct(req.body), 201);
});

export const listProductsHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await productService.listProducts(req.query as any);
  sendSuccess(res, result.products, 200, { pagination: result.pagination });
});

export const getProductHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await productService.getProductById(req.params.id as string), 200);
});

export const updateProductHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await productService.updateProduct(req.params.id as string, req.body), 200);
});

export const deleteProductHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await productService.deleteProduct(req.params.id as string), 200);
});

export const addVariantHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await productService.addVariant(req.params.id as string, req.body), 201);
});

export const deleteVariantHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await productService.deleteVariant(req.params.id as string, req.params.variantId as string), 200);
});

export const attachMediaHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await productService.attachMediaToProduct(req.params.id as string, req.body), 201);
});

export const detachMediaHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await productService.detachMedia(req.params.mediaAttachmentId as string), 200);
});

export const reorderGalleryHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await productService.reorderGallery(req.params.id as string, req.body.orderedProductMediaIds), 200);
});

export const generateCombinationsHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await productService.generateCombinations(req.body), 200);
});