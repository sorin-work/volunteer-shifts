import { sql, type Kysely } from 'kysely';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('events')
    .addColumn('id', 'serial', (c) => c.primaryKey())
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('description', 'text', (c) => c.notNull().defaultTo(''))
    .addColumn('location', 'text', (c) => c.notNull().defaultTo(''))
    .addColumn('timezone', 'text', (c) => c.notNull().defaultTo('UTC'))
    .addColumn('status', 'text', (c) =>
      c
        .notNull()
        .defaultTo('draft')
        .check(sql`status in ('draft', 'published', 'cancelled')`),
    )
    .addColumn('created_by', 'integer', (c) => c.references('users.id').onDelete('set null'))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex('events_status_idx').on('events').column('status').execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('events').execute();
}
