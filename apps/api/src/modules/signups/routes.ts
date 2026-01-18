import { Router } from 'express';
import type { AppContext } from '../../context.js';
import type { Signup } from '../../db/types.js';
import { idParam } from '../../lib/params.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { signUp } from './service.js';

export function toSignupDto(signup: Signup) {
  return {
    id: signup.id,
    shiftId: signup.shift_id,
    userId: signup.user_id,
    status: signup.status,
    createdAt: signup.created_at.toISOString(),
    cancelledAt: signup.cancelled_at?.toISOString() ?? null,
  };
}

export function signupRoutes(ctx: AppContext): Router {
  const router = Router();

  router.post('/shifts/:id/signups', requireAuth, async (req, res) => {
    const { signup } = await signUp(ctx, currentUser(req), idParam(req.params.id, 'Shift'));
    res.status(201).json({ signup: toSignupDto(signup) });
  });

  return router;
}
