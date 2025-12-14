import { Migrator, type Kysely } from 'kysely';
import { migrations } from './migrations/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function migrateToLatest(db: Kysely<any>): Promise<string[]> {
  const migrator = new Migrator({
    db,
    provider: { getMigrations: async () => migrations },
  });
  const { error, results } = await migrator.migrateToLatest();
  if (error) throw error;
  const failed = results?.find((r) => r.status === 'Error');
  if (failed) throw new Error(`Migration ${failed.migrationName} failed`);
  return (results ?? []).map((r) => r.migrationName);
}
