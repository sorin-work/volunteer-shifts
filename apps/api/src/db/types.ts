import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

// Table definitions for Kysely. Keep in sync with src/db/migrations.

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
/** DATE columns are parsed as YYYY-MM-DD strings (see connection.ts). */
type DateString = ColumnType<string, string, string>;

export type UserRole = 'coordinator' | 'volunteer';

export interface UsersTable {
  id: Generated<number>;
  email: string;
  password_hash: string;
  name: string;
  role: ColumnType<UserRole, UserRole | undefined, UserRole>;
  phone: string | null;
  birth_date: DateString | null;
  created_at: Timestamp;
}

export interface SessionsTable {
  id: string;
  user_id: number;
  expires_at: Timestamp;
  created_at: Timestamp;
}

export interface DB {
  users: UsersTable;
  sessions: SessionsTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;
