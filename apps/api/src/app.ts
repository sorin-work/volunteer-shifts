import cookieParser from 'cookie-parser';
import express from 'express';
import { pinoHttp } from 'pino-http';
import type { AppContext } from './context.js';
import { loadSession } from './middleware/auth.js';
import { createErrorHandler, notFoundHandler } from './middleware/errors.js';
import { authRoutes } from './modules/auth/routes.js';

export function createApp(ctx: AppContext) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(
    pinoHttp({
      logger: ctx.logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(loadSession(ctx));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes(ctx));

  app.use('/api', notFoundHandler);
  app.use(createErrorHandler(ctx.logger));
  return app;
}
