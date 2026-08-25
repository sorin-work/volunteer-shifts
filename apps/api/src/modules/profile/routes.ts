import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { HttpError } from '../../lib/errors.js';
import { isIsoDate } from '../../lib/time.js';
import { toPublicUser } from '../../lib/users.js';
import { validate } from '../../lib/validate.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from '../auth/passwords.js';
import { hashToken, SESSION_COOKIE } from '../auth/sessions.js';

const profileSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').max(120),
    phone: z.string().trim().max(40).nullable(),
    birthDate: z.string().refine(isIsoDate, 'Use the format YYYY-MM-DD.').nullable(),
  })
  .partial();

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    .max(200),
});

export function profileRoutes(ctx: AppContext): Router {
  const router = Router();
  router.use(requireAuth);

  router.patch('/', async (req, res) => {
    const input = validate(profileSchema, req.body);
    if (input.birthDate && input.birthDate > ctx.now().toISOString().slice(0, 10)) {
      throw new HttpError(400, 'validation_error', 'Some fields are invalid.', {
        fields: { birthDate: 'Date of birth must be in the past.' },
      });
    }
    const updated = await ctx.db
      .updateTable('users')
      .set({
        name: input.name,
        phone: input.phone === undefined ? undefined : input.phone || null,
        birth_date: input.birthDate,
      })
      .where('id', '=', currentUser(req).id)
      .returningAll()
      .executeTakeFirstOrThrow();
    res.json({ user: toPublicUser(updated) });
  });

  router.post('/password', async (req, res) => {
    const user = currentUser(req);
    const input = validate(passwordSchema, req.body);
    if (!(await verifyPassword(input.currentPassword, user.password_hash))) {
      throw new HttpError(400, 'validation_error', 'Some fields are invalid.', {
        fields: { currentPassword: 'That is not your current password.' },
      });
    }
    await ctx.db
      .updateTable('users')
      .set({ password_hash: await hashPassword(input.newPassword, ctx.config.BCRYPT_ROUNDS) })
      .where('id', '=', user.id)
      .execute();
    // Sign out every other device.
    await ctx.db
      .deleteFrom('sessions')
      .where('user_id', '=', user.id)
      .where('id', '<>', hashToken(req.sessionToken ?? ''))
      .execute();
    res.status(204).end();
  });

  // Volunteers can leave: the account and its history are removed. Hours and
  // sign-ups go with it, so coordinators should export reports first.
  router.delete('/', async (req, res) => {
    const user = currentUser(req);
    const { password } = validate(z.object({ password: z.string().min(1) }), req.body);
    if (!(await verifyPassword(password, user.password_hash))) {
      throw new HttpError(400, 'validation_error', 'Some fields are invalid.', {
        fields: { password: 'That is not your password.' },
      });
    }
    if (user.role === 'coordinator') {
      const { n } = await ctx.db
        .selectFrom('users')
        .select((eb) => eb.fn.countAll<number>().as('n'))
        .where('role', '=', 'coordinator')
        .executeTakeFirstOrThrow();
      if (Number(n) <= 1) {
        throw new HttpError(409, 'last_coordinator', 'Make someone else a coordinator first.');
      }
    }
    await ctx.db.deleteFrom('users').where('id', '=', user.id).execute();
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  });

  return router;
}
