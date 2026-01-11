import type { Migration } from 'kysely';
import * as m0001 from './0001_users_sessions.js';
import * as m0002 from './0002_events.js';
import * as m0003 from './0003_roles_shifts.js';

// Migrations are registered here explicitly (instead of read from disk) so the
// same list works from tsx, the compiled build and the test suite.
export const migrations: Record<string, Migration> = {
  '0001_users_sessions': m0001,
  '0002_events': m0002,
  '0003_roles_shifts': m0003,
};
