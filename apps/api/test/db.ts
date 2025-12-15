import { PGlite, types } from '@electric-sql/pglite';
import { Kysely, sql } from 'kysely';
import type { Database } from '../src/db/connection.js';
import { migrateToLatest } from '../src/db/migrate.js';
import type { DB } from '../src/db/types.js';
import { PGliteDialect } from './pglite-dialect.js';

// Same type parsing as node-postgres in src/db/connection.ts.
const parsers = {
  [types.INT8]: (value: string) => Number.parseInt(value, 10),
  [types.NUMERIC]: (value: string) => Number(value),
  [types.DATE]: (value: string) => value,
};

/** A fresh in-memory Postgres with every migration applied. */
export async function createTestDatabase(): Promise<Database> {
  const pglite = new PGlite({ parsers });
  const db = new Kysely<DB>({ dialect: new PGliteDialect(pglite) });
  await migrateToLatest(db);
  return db;
}

/** Empties every application table but keeps the schema. */
export async function resetDatabase(db: Database): Promise<void> {
  await sql`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN SELECT tablename FROM pg_tables
               WHERE schemaname = 'public' AND tablename NOT LIKE 'kysely_%'
      LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `.execute(db);
}
