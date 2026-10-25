# API reference

All endpoints live under `/api` and speak JSON. Authentication uses an
HTTP-only session cookie (`vs_session`) set by `POST /api/auth/login` or
`POST /api/auth/register`.

## General

- `GET /api/health` returns `{ "status": "ok" }`, or 503 when the database is unreachable.
- Every response carries an `X-Request-Id` header (taken from the request when it looks
  valid); 500 errors include it as `error.requestId` to match the logs.
- Sign-in is limited to 10 attempts per email and IP every 15 minutes.

## Errors

Every error has the same shape:

```json
{
  "error": {
    "code": "schedule_conflict",
    "message": "You already have a shift at this time.",
    "details": {}
  }
}
```

| Status | Typical codes                                                             |
| ------ | ------------------------------------------------------------------------- |
| 400    | `validation_error` (with `details.fields`), `invalid_json`, `bad_request` |
| 401    | `unauthorized`                                                            |
| 403    | `forbidden`                                                               |
| 404    | `not_found`                                                               |
| 409    | `already_signed_up`, `schedule_conflict`, `shift_started`, `role_in_use`… |
| 422    | `too_young`, `birth_date_required`, `missing_skills`                      |
| 429    | `too_many_attempts` (with a `Retry-After` header)                         |

## Auth

| Method | Path                   | Who       | Notes                                                                           |
| ------ | ---------------------- | --------- | ------------------------------------------------------------------------------- |
| POST   | `/auth/register`       | anyone    | `{ name, email, password, phone?, birthDate? }`, always a volunteer             |
| POST   | `/auth/login`          | anyone    | `{ email, password }`                                                           |
| POST   | `/auth/logout`         | any       | 204                                                                             |
| GET    | `/auth/me`             | signed in | current user with confirmed skills                                              |
| PATCH  | `/me/profile`          | signed in | `{ name?, phone?, birthDate? }`                                                 |
| POST   | `/me/profile/password` | signed in | `{ currentPassword, newPassword }`, signs out other devices                     |
| DELETE | `/me/profile`          | signed in | `{ password }`, deletes the account and its history; the last coordinator can't |

## Events, roles and shifts

| Method | Path                               | Who         | Notes                                                                                                                         |
| ------ | ---------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/events?when=upcoming\|past\|all` | signed in   | volunteers only see published events                                                                                          |
| POST   | `/events`                          | coordinator | `{ name, description?, location?, timezone }`, starts as a draft                                                              |
| GET    | `/events/:id`                      | signed in   | event, roles and shifts with `confirmedCount`, `waitlistCount`, `mySignup`                                                    |
| PATCH  | `/events/:id`                      | coordinator | partial update                                                                                                                |
| POST   | `/events/:id/publish`              | coordinator |                                                                                                                               |
| POST   | `/events/:id/cancel`               | coordinator | emails everyone with an upcoming shift                                                                                        |
| POST   | `/events/:id/duplicate`            | coordinator | `{ name?, shiftDays }` copies roles and shifts into a new draft                                                               |
| GET    | `/events/:id/summary`              | coordinator | sign-ups, check-ins, no-shows, turnout and hours                                                                              |
| GET    | `/events/:id/signups.csv`          | coordinator | every sign-up with local shift times                                                                                          |
| POST   | `/events/:id/roles`                | coordinator | `{ name, description?, minAge?, skillIds? }`                                                                                  |
| PATCH  | `/roles/:id`                       | coordinator | partial update                                                                                                                |
| DELETE | `/roles/:id`                       | coordinator | 409 while the role has shifts                                                                                                 |
| POST   | `/events/:id/shifts`               | coordinator | `{ roleId, date, startTime, endTime, capacity, notes? }` in the event's time zone; an end before the start runs past midnight |
| POST   | `/events/:id/shifts/copy`          | coordinator | `{ fromDate, toDate }` repeats a day's shifts                                                                                 |
| PATCH  | `/shifts/:id`                      | coordinator | partial update; more capacity promotes from the waitlist                                                                      |
| DELETE | `/shifts/:id`                      | coordinator |                                                                                                                               |
| GET    | `/shifts/understaffed?days=7`      | coordinator | shifts that still need people                                                                                                 |

Shift times are returned both as UTC instants (`startsAt`, `endsAt`) and as
local wall-clock values in the event's time zone (`date`, `startTime`,
`endTime`).

## Sign-ups

| Method | Path                              | Who                  | Notes                                                                               |
| ------ | --------------------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| POST   | `/shifts/:id/signups`             | signed in            | confirmed, or waitlisted when the shift is full; coordinators may pass `{ userId }` |
| GET    | `/me/signups?when=upcoming\|past` | signed in            | with shift, event, role and waitlist position                                       |
| DELETE | `/signups/:id`                    | owner or coordinator | cancels; the next person on the waitlist moves up                                   |
| GET    | `/signups/:id/calendar.ics`       | owner                | the shift as an iCalendar file                                                      |

A sign-up is refused when it overlaps another of your shifts, when the role's
minimum age or required skills aren't met, or when the shift has started.

## Rosters and attendance

| Method | Path                      | Who         | Notes                                                                                                                        |
| ------ | ------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/shifts/:id/roster`      | coordinator | confirmed volunteers and the waitlist with contact details                                                                   |
| GET    | `/shifts/:id/roster.csv`  | coordinator | CSV download                                                                                                                 |
| POST   | `/signups/:id/attendance` | coordinator | `{ attendance: "present" \| "no_show" \| "pending" }`; check-in opens an hour before the start and credits the shift's hours |

## Volunteers, skills and hours

| Method | Path                                  | Who               | Notes                                                               |
| ------ | ------------------------------------- | ----------------- | ------------------------------------------------------------------- |
| GET    | `/volunteers?search=&page=&pageSize=` | coordinator       | paginated directory                                                 |
| GET    | `/volunteers/:id`                     | self, coordinator | profile with attendance and hours stats                             |
| PUT    | `/volunteers/:id/skills`              | coordinator       | `{ skillIds }`                                                      |
| PUT    | `/volunteers/:id/role`                | coordinator       | `{ role: "coordinator" \| "volunteer" }`; you can't demote yourself |
| GET    | `/reports/hours?year=`                | coordinator       | hours and shifts per volunteer for a year                           |
| GET    | `/reports/hours.csv?year=`            | coordinator       | the same as CSV                                                     |
| GET    | `/volunteers/:id/hours?year=`         | self, coordinator | entries and yearly totals                                           |
| POST   | `/volunteers/:id/hours`               | coordinator       | manual entry `{ workedOn, hours, description }`                     |
| DELETE | `/hours/:id`                          | coordinator       | manual entries only                                                 |
| GET    | `/volunteers/:id/certificates/:year`  | self, coordinator | PDF certificate                                                     |
| GET    | `/skills`                             | signed in         |                                                                     |
| POST   | `/skills`                             | coordinator       | `{ name }`                                                          |
| DELETE | `/skills/:id`                         | coordinator       |                                                                     |

## Emails

Sent through `SMTP_URL` (Mailpit in docker compose): sign-up confirmation,
waitlist notice, promotion from the waitlist, reminder before the shift
(`REMINDER_LEAD_HOURS`, checked every `REMINDER_INTERVAL_MINUTES`), new shift
time, removed shift, event cancellation, and a daily digest of understaffed
shifts for coordinators (after `DIGEST_HOUR_UTC`).
