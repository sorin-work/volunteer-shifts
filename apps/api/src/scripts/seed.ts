import { loadConfig } from '../config.js';
import { createDatabase } from '../db/connection.js';
import { migrateToLatest } from '../db/migrate.js';
import { seedDemo } from '../seed/demo.js';

const config = loadConfig();
const db = createDatabase(config.DATABASE_URL);
try {
  await migrateToLatest(db);
  console.log((await seedDemo(db)) ? 'demo data created' : 'database already has users, skipped');
} finally {
  await db.destroy();
}
