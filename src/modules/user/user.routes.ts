import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/requirePermission';
import { createUserSchema, updateUserSchema, listUsersQuerySchema, idParamSchema } from './user.schema';
import {
  createUserHandler, listUsersHandler, getUserHandler, updateUserHandler, deleteUserHandler,
} from './user.controller';

const router = Router();

router.post('/', requirePermission('user:create'), validate(createUserSchema), createUserHandler);
router.get('/', requirePermission('user:watch'), validate(listUsersQuerySchema, 'query'), listUsersHandler);
router.get('/:id', requirePermission('user:read'), validate(idParamSchema, 'params'), getUserHandler);
router.patch('/:id', requirePermission('user:update'), validate(idParamSchema, 'params'), validate(updateUserSchema), updateUserHandler);
router.delete('/:id', requirePermission('user:delete'), validate(idParamSchema, 'params'), deleteUserHandler);

export default router;