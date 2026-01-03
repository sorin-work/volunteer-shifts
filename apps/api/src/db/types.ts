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

export type EventStatus = 'draft' | 'published' | 'cancelled';

export interface EventsTable {
  id: Generated<number>;
  name: string;
  description: ColumnType<string, string | undefined, string>;
  location: ColumnType<string, string | undefined, string>;
  timezone: ColumnType<string, string | undefined, string>;
  status: ColumnType<EventStatus, EventStatus | undefined, EventStatus>;
  created_by: number | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface DB {
  users: UsersTable;
  sessions: SessionsTable;
  events: EventsTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export type Event = Selectable<EventsTable>;
