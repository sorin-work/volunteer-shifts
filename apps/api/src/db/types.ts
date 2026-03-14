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

export interface RolesTable {
  id: Generated<number>;
  event_id: number;
  name: string;
  description: ColumnType<string, string | undefined, string>;
  min_age: number | null;
  created_at: Timestamp;
}

export interface ShiftsTable {
  id: Generated<number>;
  event_id: number;
  role_id: number;
  starts_at: Timestamp;
  ends_at: Timestamp;
  capacity: number;
  notes: ColumnType<string, string | undefined, string>;
  created_at: Timestamp;
}

export type SignupStatus = 'confirmed' | 'waitlisted' | 'cancelled';
export type Attendance = 'pending' | 'present' | 'no_show';

export interface SignupsTable {
  id: Generated<number>;
  shift_id: number;
  user_id: number;
  status: SignupStatus;
  created_at: Timestamp;
  cancelled_at: Timestamp | null;
  attendance: ColumnType<Attendance, Attendance | undefined, Attendance>;
  checked_in_at: Timestamp | null;
  attendance_marked_by: number | null;
}

export interface SkillsTable {
  id: Generated<number>;
  name: string;
  created_at: Timestamp;
}

export interface UserSkillsTable {
  user_id: number;
  skill_id: number;
}

export interface RoleSkillsTable {
  role_id: number;
  skill_id: number;
}

export interface DB {
  users: UsersTable;
  sessions: SessionsTable;
  events: EventsTable;
  roles: RolesTable;
  shifts: ShiftsTable;
  signups: SignupsTable;
  skills: SkillsTable;
  user_skills: UserSkillsTable;
  role_skills: RoleSkillsTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export type Event = Selectable<EventsTable>;
export type Role = Selectable<RolesTable>;
export type Shift = Selectable<ShiftsTable>;
export type Signup = Selectable<SignupsTable>;
export type Skill = Selectable<SkillsTable>;
