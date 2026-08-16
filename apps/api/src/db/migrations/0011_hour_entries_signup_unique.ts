import { sql, type Kysely } from 'kysely';

// A double check-in could credit the same shift twice. Drop the extra rows
// and make sure a signup has at most one hour entry from now on.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    delete from hour_entries h
    using hour_entries keep
    where h.signup_id is not null
      and keep.signup_id = h.signup_id
      and keep.id < h.id
  `.execute(db);
  await db.schema.dropIndex('hour_entries_signup_idx').execute();
  await db.schema
    .createIndex('hour_entries_signup_key')
    .on('hour_entries')
    .column('signup_id')
    .unique()
    .where(sql.ref('signup_id'), 'is not', null)
    .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('hour_entries_signup_key').execute();
  await db.schema
    .createIndex('hour_entries_signup_idx')
    .on('hour_entries')
    .column('signup_id')
    .execute();
}
