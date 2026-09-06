import { sql, type Kysely } from 'kysely';

// Remembers which once-a-day jobs already ran, so restarts don't resend.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('job_runs')
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('run_on', 'date', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('job_runs_pkey', ['name', 'run_on'])
    .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('job_runs').execute();
}
