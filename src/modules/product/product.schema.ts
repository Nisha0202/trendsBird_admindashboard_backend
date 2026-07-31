import { z } from 'zod';

const variantInputSchema = z.object({
  sku: z.string().trim().min(1),
  attributeValueIds: z.array(z.string().uuid()).min(1, 'A variant needs at least one attribute value'),
  price: z.number().positive('price must be positive'),
  salePrice: z.number().positive().optional(),
  stock: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).optional(),
  weight: z.number().positive().optional(),
  active: z.boolean().default(true),
}).refine((v) => v.salePrice === undefined || v.salePrice <= v.price, {
  message: 'salePrice must not exceed price',
  path: ['salePrice'],
});

const mediaAttachmentSchema = z.object({
  mediaId: z.string().uuid(),
  attachTo: z.enum(['product', 'variant', 'attributeValue']),
  targetRef: z.string().optional(), // variant SKU or attributeValueId within THIS payload; omit for 'product'
  isThumbnail: z.boolean().default(false),
  isGallery: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(2),
  shortDescription: z.string().trim().optional(),
  longDescription: z.string().trim().optional(),
  hasVariants: z.boolean().default(false),

  sku: z.string().trim().optional(),
  price: z.number().positive().optional(),
  salePrice: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),

  weight: z.number().positive().optional(),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().default(0),

  brandId: z.string().uuid().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),

  variants: z.array(variantInputSchema).optional(),
  media: z.array(mediaAttachmentSchema).optional(),
}).superRefine((data, ctx) => {
  if (data.hasVariants) {
    if (data.price !== undefined || data.salePrice !== undefined || data.stock !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A variable product must not set price/salePrice/stock at the product level' });
    }
    if (!data.variants || data.variants.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A variable product needs at least one variant' });
    }
  } else {
    if (data.price === undefined || data.stock === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A simple product requires price and stock' });
    }
    if (!data.sku) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A simple product requires a SKU' });
    }
    if (data.variants && data.variants.length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A simple product must not have variants' });
    }
    if (data.salePrice !== undefined && data.price !== undefined && data.salePrice > data.price) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'salePrice must not exceed price', path: ['salePrice'] });
    }
  }
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(2).optional(),
  shortDescription: z.string().trim().optional(),
  longDescription: z.string().trim().optional(),
  sku: z.string().trim().optional(),
  price: z.number().positive().optional(),
  salePrice: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  weight: z.number().positive().optional(),
  active: z.boolean().optional(),
  featured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  brandId: z.string().uuid().nullable().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
});

export const addVariantSchema = variantInputSchema;

export const listProductsQuerySchema = z.object({
  search: z.string().trim().optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  active: z.coerce.boolean().optional(),
  sortBy: z.enum(['name', 'createdAt', 'price', 'sortOrder']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const attachMediaSchema = z.object({
  mediaId: z.string().uuid(),
  isThumbnail: z.boolean().default(false),
  isGallery: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const generateCombinationsSchema = z.object({
  attributeValueGroups: z.array(z.array(z.string().uuid())).min(1),
  // e.g. [[colourRedId, colourBlueId], [sizeSId, sizeMId]] -> cartesian product
});

export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });
export const variantIdParamSchema = z.object({ id: z.string().uuid(), variantId: z.string().uuid() });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type AddVariantInput = z.infer<typeof addVariantSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type AttachMediaInput = z.infer<typeof attachMediaSchema>;
export type GenerateCombinationsInput = z.infer<typeof generateCombinationsSchema>;
