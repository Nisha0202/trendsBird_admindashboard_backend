import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { loginSchema } from './auth.schema';
import { loginHandler } from './auth.controller';

const router = Router();

router.post('/login', validate(loginSchema), loginHandler);

export default router;