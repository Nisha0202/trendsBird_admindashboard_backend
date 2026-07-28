import { Router } from 'express';
import { upload } from '../../middleware/upload';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/requirePermission';
import { listMediaQuerySchema, updateMediaSchema, idParamSchema } from './media.schema';
import { uploadHandler, listMediaHandler, updateMediaHandler, deleteMediaHandler } from './media.controller';

const router = Router();

router.post('/upload', requirePermission('media:upload'), upload.array('files', 10), uploadHandler);
router.get('/', requirePermission('media:watch'), validate(listMediaQuerySchema, 'query'), listMediaHandler);
router.patch('/:id', requirePermission('media:write'), validate(idParamSchema, 'params'), validate(updateMediaSchema), updateMediaHandler);
router.delete('/:id', requirePermission('media:delete'), validate(idParamSchema, 'params'), deleteMediaHandler);

export default router;