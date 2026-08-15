import { sql, type Kysely } from 'kysely';

// Emails used to be stored as typed, so "Ana@Example.org" and
// "ana@example.org" could be two accounts. Store them lowercased and make
// uniqueness case-insensitive. Accounts that would clash keep their original
// spelling and have to be merged by hand before the index can be created.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    update users u set email = lower(trim(u.email))
    where u.email <> lower(trim(u.email))
      and not exists (
        select 1 from users o where o.id <> u.id and lower(trim(o.email)) = lower(trim(u.email))
      )
  `.execute(db);
  await sql`create unique index users_email_lower_key on users (lower(email))`.execute(db);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await sql`drop index users_email_lower_key`.execute(db);
}
