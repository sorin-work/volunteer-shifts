import cookieParser from 'cookie-parser';
import express from 'express';
import { sql } from 'kysely';
import { pinoHttp } from 'pino-http';
import type { AppContext } from './context.js';
import { loadSession } from './middleware/auth.js';
import { createErrorHandler, notFoundHandler } from './middleware/errors.js';
import { attendanceRoutes } from './modules/attendance/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { certificateRoutes } from './modules/certificates/routes.js';
import { eventRoutes } from './modules/events/routes.js';
import { hoursRoutes } from './modules/hours/routes.js';
import { profileRoutes } from './modules/profile/routes.js';
import { roleRoutes } from './modules/roles/routes.js';
import { shiftRoutes } from './modules/shifts/routes.js';
import { signupRoutes } from './modules/signups/routes.js';
import { skillRoutes } from './modules/skills/routes.js';
import { volunteerRoutes } from './modules/volunteers/routes.js';

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
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Cache-Control': 'no-store',
    });
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(loadSession(ctx));

  app.get('/api/health', async (_req, res) => {
    try {
      await sql`select 1`.execute(ctx.db);
      res.json({ status: 'ok' });
    } catch (err) {
      ctx.logger.error({ err }, 'health check failed');
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use('/api/auth', authRoutes(ctx));
  app.use('/api/me/profile', profileRoutes(ctx));
  app.use('/api/events', eventRoutes(ctx));
  app.use('/api/skills', skillRoutes(ctx));
  app.use('/api/volunteers', volunteerRoutes(ctx));
  app.use('/api', roleRoutes(ctx));
  app.use('/api', shiftRoutes(ctx));
  app.use('/api', signupRoutes(ctx));
  app.use('/api', attendanceRoutes(ctx));
  app.use('/api', hoursRoutes(ctx));
  app.use('/api', certificateRoutes(ctx));

  app.use('/api', notFoundHandler);
  app.use(createErrorHandler(ctx.logger));
  return app;
}
