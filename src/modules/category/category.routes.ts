import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/requirePermission';
import { createCategorySchema, updateCategorySchema, idParamSchema } from './category.schema';
import {
  createCategoryHandler, getTreeHandler, getCategoryHandler, updateCategoryHandler, deleteCategoryHandler,
} from './category.controller';

const router = Router();

router.post('/', requirePermission('category:create'), validate(createCategorySchema), createCategoryHandler);
router.get('/tree', requirePermission('category:watch'), getTreeHandler);
router.get('/:id', requirePermission('category:read'), validate(idParamSchema, 'params'), getCategoryHandler);
router.patch('/:id', requirePermission('category:update'), validate(idParamSchema, 'params'), validate(updateCategorySchema), updateCategoryHandler);
router.delete('/:id', requirePermission('category:delete'), validate(idParamSchema, 'params'), deleteCategoryHandler);

export default router;