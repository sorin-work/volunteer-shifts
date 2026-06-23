import type { Kysely } from 'kysely';

// Counting confirmed spots and finding shift hours were sequential scans.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createIndex('signups_shift_status_idx')
    .on('signups')
    .columns(['shift_id', 'status'])
    .execute();
  await db.schema
    .createIndex('hour_entries_signup_idx')
    .on('hour_entries')
    .column('signup_id')
    .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('hour_entries_signup_idx').execute();
  await db.schema.dropIndex('signups_shift_status_idx').execute();
}
