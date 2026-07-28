import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/requirePermission';
import { createRoleSchema, updateRoleSchema, listRolesQuerySchema, idParamSchema } from './role.schema';
import {
  createRoleHandler, listRolesHandler, getRoleHandler, updateRoleHandler, deleteRoleHandler,
} from './role.controller';

const router = Router();

router.post('/', requirePermission('role:create'), validate(createRoleSchema), createRoleHandler);
router.get('/', requirePermission('role:watch'), validate(listRolesQuerySchema, 'query'), listRolesHandler);
router.get('/:id', requirePermission('role:read'), validate(idParamSchema, 'params'), getRoleHandler);
router.patch('/:id', requirePermission('role:update'), validate(idParamSchema, 'params'), validate(updateRoleSchema), updateRoleHandler);
router.delete('/:id', requirePermission('role:delete'), validate(idParamSchema, 'params'), deleteRoleHandler);

export default router;