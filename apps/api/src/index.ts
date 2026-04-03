import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase } from './db/connection.js';
import { migrateToLatest } from './db/migrate.js';
import { createLogger } from './lib/logger.js';
import { seedDemo } from './seed/demo.js';

const config = loadConfig();
const logger = createLogger(config);
const db = createDatabase(config.DATABASE_URL);
await migrateToLatest(db);
if (config.SEED_DEMO && (await seedDemo(db))) {
  logger.info('seeded demo data (coordinator@example.org / volunteer@example.org)');
}

const app = createApp({ db, config, logger, now: () => new Date() });
const server = app.listen(config.PORT, () => {
  logger.info(`api listening on http://localhost:${config.PORT}`);
});

async function shutdown() {
  server.close();
  await db.destroy();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
