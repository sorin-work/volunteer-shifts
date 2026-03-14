import { sql, type Kysely } from 'kysely';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('signups')
    .addColumn('attendance', 'text', (c) =>
      c
        .notNull()
        .defaultTo('pending')
        .check(sql`attendance in ('pending', 'present', 'no_show')`),
    )
    .addColumn('checked_in_at', 'timestamptz')
    .addColumn('attendance_marked_by', 'integer', (c) =>
      c.references('users.id').onDelete('set null'),
    )
    .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('signups')
    .dropColumn('attendance')
    .dropColumn('checked_in_at')
    .dropColumn('attendance_marked_by')
    .execute();
}
