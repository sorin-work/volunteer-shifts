import type { Config } from './config.js';
import type { Database } from './db/connection.js';

/** Everything a request handler needs. Built once in index.ts, or per test. */
export interface AppContext {
  db: Database;
  config: Config;
  /** Injected so tests can control the clock. */
  now: () => Date;
}
