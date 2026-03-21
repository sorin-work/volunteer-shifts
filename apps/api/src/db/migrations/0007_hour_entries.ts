import { sql, type Kysely } from 'kysely';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('hour_entries')
    .addColumn('id', 'serial', (c) => c.primaryKey())
    .addColumn('user_id', 'integer', (c) => c.notNull().references('users.id').onDelete('cascade'))
    // Set for hours credited from a shift check-in; null for manual entries.
    .addColumn('signup_id', 'integer', (c) => c.references('signups.id').onDelete('cascade'))
    .addColumn('worked_on', 'date', (c) => c.notNull())
    .addColumn('hours', sql`numeric(5, 2)`, (c) => c.notNull().check(sql`hours > 0`))
    .addColumn('description', 'text', (c) => c.notNull().defaultTo(''))
    .addColumn('created_by', 'integer', (c) => c.references('users.id').onDelete('set null'))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('hour_entries_user_worked_idx')
    .on('hour_entries')
    .columns(['user_id', 'worked_on'])
    .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('hour_entries').execute();
}
