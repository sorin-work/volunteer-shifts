import type { RequestHandler } from 'express';
import type { AppContext } from '../context.js';
import type { User } from '../db/types.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { findSessionUser, SESSION_COOKIE } from '../modules/auth/sessions.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      sessionToken?: string;
    }
  }
}

/** Attaches req.user when the request carries a valid session cookie. */
export function loadSession(ctx: AppContext): RequestHandler {
  return async (req, _res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token) {
      const user = await findSessionUser(ctx.db, token, ctx.now());
      if (user) {
        req.user = user;
        req.sessionToken = token;
      }
    }
    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) throw unauthorized();
  next();
};

export const requireCoordinator: RequestHandler = (req, _res, next) => {
  if (!req.user) throw unauthorized();
  if (req.user.role !== 'coordinator') throw forbidden('Only coordinators can do that.');
  next();
};

/** The signed-in user; only call after requireAuth. */
export function currentUser(req: Express.Request): User {
  if (!req.user) throw unauthorized();
  return req.user;
}
