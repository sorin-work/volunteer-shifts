import { Router, type Request } from 'express';
import type { AppContext } from '../../context.js';
import { conflict, notFound } from '../../lib/errors.js';
import { idParam } from '../../lib/params.js';
import { validate } from '../../lib/validate.js';
import { currentUser, requireAuth, requireCoordinator } from '../../middleware/auth.js';
import { toEventDto } from './dto.js';
import { createEventSchema, updateEventSchema } from './schemas.js';

export function eventRoutes(ctx: AppContext): Router {
  const router = Router();
  router.use(requireAuth);

  /** Loads an event the current user may see: volunteers only see published ones. */
  async function findVisibleEvent(req: Request) {
    const id = idParam(req.params.id, 'Event');
    const event = await ctx.db
      .selectFrom('events')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!event) throw notFound('Event');
    if (currentUser(req).role !== 'coordinator' && event.status === 'draft') {
      throw notFound('Event');
    }
    return event;
  }

  router.get('/', async (req, res) => {
    let query = ctx.db.selectFrom('events').selectAll().orderBy('created_at', 'desc');
    if (currentUser(req).role !== 'coordinator') {
      query = query.where('status', '=', 'published');
    }
    const events = await query.execute();
    res.json({ events: events.map(toEventDto) });
  });

  router.post('/', requireCoordinator, async (req, res) => {
    const input = validate(createEventSchema, req.body);
    const event = await ctx.db
      .insertInto('events')
      .values({ ...input, created_by: currentUser(req).id })
      .returningAll()
      .executeTakeFirstOrThrow();
    res.status(201).json({ event: toEventDto(event) });
  });

  router.get('/:id', async (req, res) => {
    const event = await findVisibleEvent(req);
    res.json({ event: toEventDto(event) });
  });

  router.patch('/:id', requireCoordinator, async (req, res) => {
    const event = await findVisibleEvent(req);
    const input = validate(updateEventSchema, req.body);
    if (event.status === 'cancelled') {
      throw conflict('event_cancelled', 'Cancelled events can no longer be edited.');
    }
    const updated = await ctx.db
      .updateTable('events')
      .set({ ...input, updated_at: ctx.now() })
      .where('id', '=', event.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    res.json({ event: toEventDto(updated) });
  });

  router.post('/:id/publish', requireCoordinator, async (req, res) => {
    const event = await findVisibleEvent(req);
    if (event.status === 'cancelled') {
      throw conflict('event_cancelled', 'A cancelled event cannot be published again.');
    }
    const updated = await ctx.db
      .updateTable('events')
      .set({ status: 'published', updated_at: ctx.now() })
      .where('id', '=', event.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    res.json({ event: toEventDto(updated) });
  });

  router.post('/:id/cancel', requireCoordinator, async (req, res) => {
    const event = await findVisibleEvent(req);
    const updated = await ctx.db
      .updateTable('events')
      .set({ status: 'cancelled', updated_at: ctx.now() })
      .where('id', '=', event.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    res.json({ event: toEventDto(updated) });
  });

  return router;
}
