import { Router, type Response } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { conflict, unauthorized } from '../../lib/errors.js';
import { toPublicUser } from '../../lib/users.js';
import { validate } from '../../lib/validate.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from './passwords.js';
import { createSession, deleteSession, SESSION_COOKIE } from './sessions.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.');

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  email: z.string().trim().email('Enter a valid email address.').max(254),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    .max(200),
  phone: z.string().trim().max(40).optional(),
  birthDate: isoDate.optional(),
});

const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

export function authRoutes(ctx: AppContext): Router {
  const router = Router();

  async function startSession(res: Response, userId: number) {
    const { token, expiresAt } = await createSession(
      ctx.db,
      userId,
      ctx.config.SESSION_TTL_HOURS,
      ctx.now(),
    );
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: ctx.config.NODE_ENV === 'production',
      expires: expiresAt,
      path: '/',
    });
  }

  router.post('/register', async (req, res) => {
    const input = validate(registerSchema, req.body);
    const existing = await ctx.db
      .selectFrom('users')
      .select('id')
      .where('email', '=', input.email)
      .executeTakeFirst();
    if (existing) throw conflict('email_taken', 'An account with this email already exists.');

    const user = await ctx.db
      .insertInto('users')
      .values({
        email: input.email,
        name: input.name,
        password_hash: await hashPassword(input.password, ctx.config.BCRYPT_ROUNDS),
        phone: input.phone || null,
        birth_date: input.birthDate ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await startSession(res, user.id);
    res.status(201).json({ user: toPublicUser(user) });
  });

  router.post('/login', async (req, res) => {
    const input = validate(loginSchema, req.body);
    const user = await ctx.db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', input.email)
      .executeTakeFirst();
    if (!user || !(await verifyPassword(input.password, user.password_hash))) {
      throw unauthorized('Email or password is incorrect.');
    }
    await startSession(res, user.id);
    res.json({ user: toPublicUser(user) });
  });

  router.post('/logout', async (req, res) => {
    if (req.sessionToken) await deleteSession(ctx.db, req.sessionToken);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: toPublicUser(currentUser(req)) });
  });

  return router;
}
