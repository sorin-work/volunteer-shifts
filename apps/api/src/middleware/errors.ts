import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../lib/errors.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res
    .status(404)
    .json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
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
  console.error(err);
  res.status(500).json({ error: { code: 'internal', message: 'Something went wrong.' } });
};
