// Shapes returned by the API (see apps/api/src/modules/*/dto.ts).

export type Role = 'coordinator' | 'volunteer';

export interface SkillRef {
  id: number;
  name: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  birthDate: string | null;
  skills?: SkillRef[];
}

export type EventStatus = 'draft' | 'published' | 'cancelled';

export interface VolunteerEvent {
  id: number;
  name: string;
  description: string;
  location: string;
  timezone: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EventRole {
  id: number;
  eventId: number;
  name: string;
  description: string;
  minAge: number | null;
  requiredSkills: SkillRef[];
}

export type SignupStatus = 'confirmed' | 'waitlisted' | 'cancelled';

export interface Shift {
  id: number;
  eventId: number;
  roleId: number;
  startsAt: string;
  endsAt: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  notes: string;
}

export interface EventShift extends Shift {
  confirmedCount: number;
  waitlistCount: number;
  mySignup: { id: number; status: SignupStatus } | null;
}

export interface EventDetails {
  event: VolunteerEvent;
  roles: EventRole[];
  shifts: EventShift[];
}

export interface Signup {
  id: number;
  shiftId: number;
  userId: number;
  status: SignupStatus;
  createdAt: string;
  cancelledAt: string | null;
  waitlistPosition?: number | null;
}

export interface MySignup extends Signup {
  shift: Shift;
  event: Pick<VolunteerEvent, 'id' | 'name' | 'location' | 'timezone' | 'status'>;
  role: { id: number; name: string };
}

export interface EventSummary extends VolunteerEvent {
  firstShiftAt: string | null;
  lastShiftEndsAt: string | null;
  shiftCount: number;
  totalSpots: number;
  filledSpots: number;
}

export type Attendance = 'pending' | 'present' | 'no_show';

export interface RosterEntry {
  signupId: number;
  status: SignupStatus;
  attendance: Attendance;
  checkedInAt: string | null;
  signedUpAt: string;
  volunteer: { id: number; name: string; email: string; phone: string | null };
}

export interface Roster {
  shift: Shift;
  event: { id: number; name: string; timezone: string };
  role: EventRole;
  confirmed: RosterEntry[];
  waitlist: RosterEntry[];
}

export interface HourEntry {
  id: number;
  userId: number;
  signupId: number | null;
  workedOn: string;
  hours: number;
  description: string;
  source: 'shift' | 'manual';
  createdAt: string;
}

export interface YearTotal {
  year: number;
  hours: number;
  entries: number;
}

export interface HoursLog {
  volunteer: { id: number; name: string };
  entries: HourEntry[];
  totals: YearTotal[];
}

export interface Paged {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface VolunteerListItem {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  joinedAt: string;
}

export interface VolunteerProfile {
  volunteer: User & { skills: SkillRef[]; joinedAt: string };
  stats: {
    upcomingShifts: number;
    attended: number;
    noShows: number;
    hoursThisYear: number;
    totalHours: number;
  };
}
