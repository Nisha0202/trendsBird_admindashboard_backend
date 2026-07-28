import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/requirePermission';
import {
  createAttributeSchema, updateAttributeSchema, createValueSchema, updateValueSchema,
  idParamSchema, valueIdParamSchema,
} from './attribute.schema';
import {
  createAttributeHandler, listAttributesHandler, getAttributeHandler, updateAttributeHandler,
  deleteAttributeHandler, addValueHandler, updateValueHandler, deleteValueHandler,
} from './attribute.controller';

const router = Router();

router.post('/', requirePermission('attribute:create'), validate(createAttributeSchema), createAttributeHandler);
router.get('/', requirePermission('attribute:watch'), listAttributesHandler);
router.get('/:id', requirePermission('attribute:read'), validate(idParamSchema, 'params'), getAttributeHandler);
router.patch('/:id', requirePermission('attribute:update'), validate(idParamSchema, 'params'), validate(updateAttributeSchema), updateAttributeHandler);
router.delete('/:id', requirePermission('attribute:delete'), validate(idParamSchema, 'params'), deleteAttributeHandler);

// Nested value routes — the ones the spec explicitly warns get left unguarded.
router.post('/:id/values', requirePermission('attribute:update'), validate(idParamSchema, 'params'), validate(createValueSchema), addValueHandler);
router.patch('/:id/values/:valueId', requirePermission('attribute:update'), validate(valueIdParamSchema, 'params'), validate(updateValueSchema), updateValueHandler);
router.delete('/:id/values/:valueId', requirePermission('attribute:update'), validate(valueIdParamSchema, 'params'), deleteValueHandler);

export default router;