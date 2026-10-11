import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase } from './db/connection.js';
import { migrateToLatest } from './db/migrate.js';
import { createLogger } from './lib/logger.js';
import { createLogMailer, createSmtpMailer } from './mail/mailer.js';
import { startReminderLoop } from './modules/reminders/scheduler.js';
import { seedDemo } from './seed/demo.js';

const config = loadConfig();
const logger = createLogger(config);
const db = createDatabase(config.DATABASE_URL);
await migrateToLatest(db);
if (config.SEED_DEMO && (await seedDemo(db))) {
  logger.info('seeded demo data (coordinator@example.org / volunteer@example.org)');
}

if (!config.SMTP_URL) logger.warn('SMTP_URL is not set, emails will not be delivered');
const mailer = config.SMTP_URL
  ? createSmtpMailer(config.SMTP_URL, config.MAIL_FROM)
  : createLogMailer(logger);

const ctx = { db, config, logger, mailer, now: () => new Date() };
const app = createApp(ctx);
const stopReminders = startReminderLoop(ctx);
const server = app.listen(config.PORT, () => {
  logger.info(`api listening on http://localhost:${config.PORT}`);
});

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, 'shutting down');
  stopReminders();
  // Stop accepting connections and let in-flight requests finish, but don't
  // hang forever on keep-alive sockets.
  const force = setTimeout(() => server.closeAllConnections(), 10_000);
  force.unref();
  server.closeIdleConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.destroy();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
