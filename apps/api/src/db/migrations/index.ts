import type { Migration } from 'kysely';

// Migrations are registered here explicitly (instead of read from disk) so the
// same list works from tsx, the compiled build and the test suite.
export const migrations: Record<string, Migration> = {};
