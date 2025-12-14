import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { DB } from './types.js';

// Return BIGINT counts and NUMERIC hours as numbers and DATE columns as
// plain YYYY-MM-DD strings, so nothing shifts when a date crosses time zones.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number.parseInt(value, 10));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value));
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

export type Database = Kysely<DB>;

export function createDatabase(connectionString: string): Database {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString, max: 10 }),
    }),
  });
}
