import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/requirePermission';
import { createBrandSchema, updateBrandSchema, listBrandsQuerySchema, idParamSchema } from './brand.schema';
import { createBrandHandler, listBrandsHandler, getBrandHandler, updateBrandHandler, deleteBrandHandler } from './brand.controller';

const router = Router();

router.post('/', requirePermission('brand:create'), validate(createBrandSchema), createBrandHandler);
router.get('/', requirePermission('brand:watch'), validate(listBrandsQuerySchema, 'query'), listBrandsHandler);
router.get('/:id', requirePermission('brand:read'), validate(idParamSchema, 'params'), getBrandHandler);
router.patch('/:id', requirePermission('brand:update'), validate(idParamSchema, 'params'), validate(updateBrandSchema), updateBrandHandler);
router.delete('/:id', requirePermission('brand:delete'), validate(idParamSchema, 'params'), deleteBrandHandler);

export default router;