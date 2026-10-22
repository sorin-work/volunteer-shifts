import type { Kysely } from 'kysely';

// The reminder job, the digest and the understaffed list all scan shifts by
// start time across events.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.createIndex('shifts_starts_at_idx').on('shifts').column('starts_at').execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('shifts_starts_at_idx').execute();
}
