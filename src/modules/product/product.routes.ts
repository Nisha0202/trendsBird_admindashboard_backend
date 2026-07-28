import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/requirePermission';
import {
  createProductSchema, updateProductSchema, listProductsQuerySchema, addVariantSchema,
  attachMediaSchema, generateCombinationsSchema, idParamSchema, variantIdParamSchema,
} from './product.schema';
import {
  createProductHandler, listProductsHandler, getProductHandler, updateProductHandler, deleteProductHandler,
  addVariantHandler, deleteVariantHandler, attachMediaHandler, detachMediaHandler, reorderGalleryHandler,
  generateCombinationsHandler,
} from './product.controller';

const router = Router();

router.post('/', requirePermission('product:create'), validate(createProductSchema), createProductHandler);
router.get('/', requirePermission('product:watch'), validate(listProductsQuerySchema, 'query'), listProductsHandler);
router.post('/generate-combinations', requirePermission('product:create'), validate(generateCombinationsSchema), generateCombinationsHandler);
router.get('/:id', requirePermission('product:read'), validate(idParamSchema, 'params'), getProductHandler);
router.patch('/:id', requirePermission('product:update'), validate(idParamSchema, 'params'), validate(updateProductSchema), updateProductHandler);
router.delete('/:id', requirePermission('product:delete'), validate(idParamSchema, 'params'), deleteProductHandler);

router.post('/:id/variants', requirePermission('product:update'), validate(idParamSchema, 'params'), validate(addVariantSchema), addVariantHandler);
router.delete('/:id/variants/:variantId', requirePermission('product:update'), validate(variantIdParamSchema, 'params'), deleteVariantHandler);

router.post('/:id/media', requirePermission('product:update'), validate(idParamSchema, 'params'), validate(attachMediaSchema), attachMediaHandler);
router.delete('/:id/media/:mediaAttachmentId', requirePermission('product:update'), validate(idParamSchema, 'params'), detachMediaHandler);
router.patch(
  '/:id/media/reorder',
  requirePermission('product:update'),
  validate(idParamSchema, 'params'),
  validate(z.object({ orderedProductMediaIds: z.array(z.string().uuid()) })),
  reorderGalleryHandler
);

export default router;