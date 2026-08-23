import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res
    .status(404)
    .json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });
};

export const createErrorHandler =
  (logger: Logger): ErrorRequestHandler =>
  (err, req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      });
      return;
    }
    // body-parser marks malformed JSON with type 'entity.parse.failed'.
    if (err?.type === 'entity.parse.failed') {
      res
        .status(400)
        .json({ error: { code: 'invalid_json', message: 'Request body is not valid JSON.' } });
      return;
    }
    if (err?.type === 'entity.too.large') {
      res
        .status(413)
        .json({ error: { code: 'payload_too_large', message: 'Request body is too large.' } });
      return;
    }
    logger.error({ err, method: req.method, url: req.originalUrl }, 'unhandled error');
    res.status(500).json({
      error: {
        code: 'internal',
        message: 'Something went wrong.',
        requestId: String(req.id ?? ''),
      },
    });
  };
