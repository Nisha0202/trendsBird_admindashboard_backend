import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import roleRoutes from './modules/role/role.routes';
import userRoutes from './modules/user/user.routes';
import { authGuard } from './middleware/authGuard';

import permissionRoutes from './modules/permission/permission.routes';
export const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});
app.use(authGuard); 

// Module routes will be mounted here 
app.use('/api/v1/auth', authRoutes);

app.use('/api/v1/permissions', permissionRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/users', userRoutes);


app.use(notFoundHandler);
app.use(errorHandler);


