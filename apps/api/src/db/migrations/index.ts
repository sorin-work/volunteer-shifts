import type { Migration } from 'kysely';
import * as m0001 from './0001_users_sessions.js';
import * as m0002 from './0002_events.js';
import * as m0003 from './0003_roles_shifts.js';
import * as m0004 from './0004_signups.js';
import * as m0005 from './0005_skills.js';
import * as m0006 from './0006_attendance.js';
import * as m0007 from './0007_hour_entries.js';
import * as m0008 from './0008_reminders.js';
import * as m0009 from './0009_signup_indexes.js';
import * as m0010 from './0010_email_case.js';
import * as m0011 from './0011_hour_entries_signup_unique.js';
import * as m0012 from './0012_job_runs.js';

// Migrations are registered here explicitly (instead of read from disk) so the
// same list works from tsx, the compiled build and the test suite.
export const migrations: Record<string, Migration> = {
  '0001_users_sessions': m0001,
  '0002_events': m0002,
  '0003_roles_shifts': m0003,
  '0004_signups': m0004,
  '0005_skills': m0005,
  '0006_attendance': m0006,
  '0007_hour_entries': m0007,
  '0008_reminders': m0008,
  '0009_signup_indexes': m0009,
  '0010_email_case': m0010,
  '0011_hour_entries_signup_unique': m0011,
  '0012_job_runs': m0012,
};
