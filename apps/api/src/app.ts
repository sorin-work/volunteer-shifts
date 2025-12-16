import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/errors.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
