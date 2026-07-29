import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { authGuard, loginRateLimiter } from '../../middleware/authGuard';
import { loginSchema, refreshSchema, logoutSchema } from './auth.schema';
import { loginHandler, sessionHandler, refreshHandler, logoutHandler } from './auth.controller';

const router = Router();
// Example inside your auth router:

router.post('/login', loginRateLimiter, validate(loginSchema), loginHandler);
router.post('/refresh', validate(refreshSchema), refreshHandler);
router.post('/logout', validate(logoutSchema), logoutHandler);

router.get('/me', sessionHandler);

export default router;