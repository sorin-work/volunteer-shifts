import { sql, type Kysely } from 'kysely';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('roles')
    .addColumn('id', 'serial', (c) => c.primaryKey())
    .addColumn('event_id', 'integer', (c) =>
      c.notNull().references('events.id').onDelete('cascade'),
    )
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('description', 'text', (c) => c.notNull().defaultTo(''))
    .addColumn('min_age', 'integer', (c) => c.check(sql`min_age between 0 and 120`))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('roles_event_name_key', ['event_id', 'name'])
    .execute();

  await db.schema
    .createTable('shifts')
    .addColumn('id', 'serial', (c) => c.primaryKey())
    .addColumn('event_id', 'integer', (c) =>
      c.notNull().references('events.id').onDelete('cascade'),
    )
    .addColumn('role_id', 'integer', (c) => c.notNull().references('roles.id').onDelete('cascade'))
    .addColumn('starts_at', 'timestamptz', (c) => c.notNull())
    .addColumn('ends_at', 'timestamptz', (c) => c.notNull())
    .addColumn('capacity', 'integer', (c) => c.notNull().check(sql`capacity > 0`))
    .addColumn('notes', 'text', (c) => c.notNull().defaultTo(''))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addCheckConstraint('shifts_time_order', sql`ends_at > starts_at`)
    .execute();

  await db.schema
    .createIndex('shifts_event_starts_idx')
    .on('shifts')
    .columns(['event_id', 'starts_at'])
    .execute();
  await db.schema.createIndex('shifts_role_idx').on('shifts').column('role_id').execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('shifts').execute();
  await db.schema.dropTable('roles').execute();
}
