import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/requirePermission';
import {
  createPermissionGroupSchema,
  updatePermissionGroupSchema,
  listPermissionsQuerySchema,
  idParamSchema,
} from './permission.schema';
import {
  createGroupHandler,
  listGroupsHandler,
  getGroupHandler,
  updateGroupHandler,
  deletePermissionHandler,
} from './permission.controller';

const router = Router();

router.post('/groups', requirePermission('permission:create'), validate(createPermissionGroupSchema), createGroupHandler);
router.get('/groups', requirePermission('permission:watch'), validate(listPermissionsQuerySchema, 'query'), listGroupsHandler);
router.get('/groups/:id', requirePermission('permission:read'), validate(idParamSchema, 'params'), getGroupHandler);
router.patch('/groups/:id', requirePermission('permission:update'), validate(idParamSchema, 'params'), validate(updatePermissionGroupSchema), updateGroupHandler);
router.delete('/:id', requirePermission('permission:delete'), validate(idParamSchema, 'params'), deletePermissionHandler);

export default router;