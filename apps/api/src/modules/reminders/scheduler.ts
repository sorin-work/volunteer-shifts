import type { AppContext } from '../../context.js';
import { sendCoordinatorDigest } from '../digest/service.js';
import { sendDueReminders } from './service.js';

/**
 * Runs the reminder job (and the once-a-day coordinator digest) every
 * REMINDER_INTERVAL_MINUTES; 0 turns it off.
 */
export function startReminderLoop(ctx: AppContext): () => void {
  const minutes = ctx.config.REMINDER_INTERVAL_MINUTES;
  if (minutes <= 0) return () => {};

  let running = false;
  const tick = async () => {
    // Skip a tick rather than overlap a slow run (e.g. while SMTP is down).
    if (running) return;
    running = true;
    try {
      const sent = await sendDueReminders(ctx);
      if (sent) ctx.logger.info({ sent }, 'sent shift reminders');
      const digests = await sendCoordinatorDigest(ctx);
      if (digests) ctx.logger.info({ digests }, 'sent coordinator digest');
    } catch (err) {
      ctx.logger.error({ err }, 'reminder job failed');
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, minutes * 60_000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
