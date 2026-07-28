import { Request, Response } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import { sendSuccess } from '../../common/ApiResponse';
import * as attributeService from './attribute.service';

export const createAttributeHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await attributeService.createAttribute(req.body), 201);
});

export const listAttributesHandler = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await attributeService.listAttributes(), 200);
});

export const getAttributeHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await attributeService.getAttributeById(req.params.id as string ), 200);
});

export const updateAttributeHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await attributeService.updateAttribute(req.params.id as string, req.body), 200);
});

export const deleteAttributeHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await attributeService.deleteAttribute(req.params.id as string), 200);
});

export const addValueHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await attributeService.addValue(req.params.id as string, req.body), 201);
});

export const updateValueHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await attributeService.updateValue(req.params.id as string, req.params.valueId as string, req.body), 200);
});

export const deleteValueHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await attributeService.deleteValue(req.params.id as string, req.params.valueId as string), 200);
});