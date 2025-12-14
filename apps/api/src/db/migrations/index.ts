import type { Migration } from 'kysely';
import * as m0001 from './0001_users_sessions.js';

// Migrations are registered here explicitly (instead of read from disk) so the
// same list works from tsx, the compiled build and the test suite.
export const migrations: Record<string, Migration> = {
  '0001_users_sessions': m0001,
};
