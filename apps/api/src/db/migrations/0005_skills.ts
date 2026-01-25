import { sql, type Kysely } from 'kysely';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('skills')
    .addColumn('id', 'serial', (c) => c.primaryKey())
    .addColumn('name', 'text', (c) => c.notNull().unique())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('user_skills')
    .addColumn('user_id', 'integer', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('skill_id', 'integer', (c) =>
      c.notNull().references('skills.id').onDelete('cascade'),
    )
    .addPrimaryKeyConstraint('user_skills_pkey', ['user_id', 'skill_id'])
    .execute();

  await db.schema
    .createTable('role_skills')
    .addColumn('role_id', 'integer', (c) => c.notNull().references('roles.id').onDelete('cascade'))
    .addColumn('skill_id', 'integer', (c) =>
      c.notNull().references('skills.id').onDelete('cascade'),
    )
    .addPrimaryKeyConstraint('role_skills_pkey', ['role_id', 'skill_id'])
    .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('role_skills').execute();
  await db.schema.dropTable('user_skills').execute();
  await db.schema.dropTable('skills').execute();
}
