import cookieParser from 'cookie-parser';
import express from 'express';
import type { AppContext } from './context.js';
import { loadSession } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { authRoutes } from './modules/auth/routes.js';

export function createApp(ctx: AppContext) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(loadSession(ctx));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes(ctx));

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
