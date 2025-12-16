export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Please sign in to continue.') =>
  new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'You are not allowed to do that.') =>
  new HttpError(403, 'forbidden', message);
export const notFound = (what = 'Resource') =>
  new HttpError(404, 'not_found', `${what} not found.`);
export const conflict = (code: string, message: string, details?: unknown) =>
  new HttpError(409, code, message, details);
export const unprocessable = (code: string, message: string, details?: unknown) =>
  new HttpError(422, code, message, details);
