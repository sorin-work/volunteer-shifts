import type { Config } from './config.js';
import type { Database } from './db/connection.js';
import type { Logger } from './lib/logger.js';
import type { Mailer } from './mail/mailer.js';

/** Everything a request handler needs. Built once in index.ts, or per test. */
export interface AppContext {
  db: Database;
  config: Config;
  logger: Logger;
  mailer: Mailer;
  /** Injected so tests can control the clock. */
  now: () => Date;
}
