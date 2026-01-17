import { sql, type Kysely } from 'kysely';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('signups')
    .addColumn('id', 'serial', (c) => c.primaryKey())
    .addColumn('shift_id', 'integer', (c) =>
      c.notNull().references('shifts.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'integer', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('status', 'text', (c) =>
      c.notNull().check(sql`status in ('confirmed', 'waitlisted', 'cancelled')`),
    )
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('cancelled_at', 'timestamptz')
    .execute();

  // One active signup per volunteer and shift; cancelled rows are kept as history.
  await db.schema
    .createIndex('signups_active_unique')
    .on('signups')
    .columns(['shift_id', 'user_id'])
    .unique()
    .where(sql.ref('status'), '<>', 'cancelled')
    .execute();
  await db.schema.createIndex('signups_user_idx').on('signups').column('user_id').execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('signups').execute();
}
