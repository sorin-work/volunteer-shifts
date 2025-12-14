import { loadConfig } from '../config.js';
import { createDatabase } from '../db/connection.js';
import { migrateToLatest } from '../db/migrate.js';

const config = loadConfig();
const db = createDatabase(config.DATABASE_URL);
try {
  const applied = await migrateToLatest(db);
  console.log(applied.length ? `applied: ${applied.join(', ')}` : 'database is up to date');
} finally {
  await db.destroy();
}
