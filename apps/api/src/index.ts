import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase } from './db/connection.js';
import { migrateToLatest } from './db/migrate.js';

const config = loadConfig();
const db = createDatabase(config.DATABASE_URL);
await migrateToLatest(db);

const app = createApp({ db, config, now: () => new Date() });
const server = app.listen(config.PORT, () => {
  console.log(`api listening on http://localhost:${config.PORT}`);
});

async function shutdown() {
  server.close();
  await db.destroy();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
