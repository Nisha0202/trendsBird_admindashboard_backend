import { z } from 'zod';

const attributeTypeEnum = z.enum(['DROPDOWN', 'RADIO', 'CHECKBOX', 'COLOUR_SWATCH', 'IMAGE_SWATCH']);

export const createAttributeSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  type: attributeTypeEnum,
  values: z
    .array(
      z.object({
        value: z.string().trim().min(1),
        referenceValue: z.string().trim().optional(), // hex code
        referenceMediaId: z.string().uuid().optional(), // image swatch
      })
    )
    .optional(),
});

export const updateAttributeSchema = z.object({
  name: z.string().trim().min(2).optional(),
  type: attributeTypeEnum.optional(),
});

export const createValueSchema = z.object({
  value: z.string().trim().min(1),
  referenceValue: z.string().trim().optional(),
  referenceMediaId: z.string().uuid().optional(),
});

export const updateValueSchema = z.object({
  value: z.string().trim().min(1).optional(),
  referenceValue: z.string().trim().optional(),
  referenceMediaId: z.string().uuid().nullable().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });
export const valueIdParamSchema = z.object({ id: z.string().uuid(), valueId: z.string().uuid() });

export type CreateAttributeInput = z.infer<typeof createAttributeSchema>;
export type UpdateAttributeInput = z.infer<typeof updateAttributeSchema>;
export type CreateValueInput = z.infer<typeof createValueSchema>;
export type UpdateValueInput = z.infer<typeof updateValueSchema>;