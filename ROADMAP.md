# Roadmap

Things I might add to volunteer-shifts. The app covers the loop a small
nonprofit needs today (plan events, take sign-ups, remind, check in, count
hours), so nothing here is promised or scheduled. These are ideas, written down
with enough detail that I (or anyone else) can pick one up later without
starting from zero. Items may change, move between groups or be dropped.

What the app does today is in the [README](README.md) and the notes under
[docs/](docs/).

- **Next**: small or well understood, mostly gaps in what already exists. I
  would start with these.
- **Later**: worth doing, but bigger or waiting on a decision.
- **Maybe**: not sure yet that they are worth the extra complexity.

Sizes are rough: **S** is an evening or two, **M** a few evenings up to a
couple of weekends, **L** several weeks of spare time.

Each item is meant to fit in one pull request and to be covered by the test
suite. There are no browser tests. The API tests in `apps/api/test` run real
SQL against PGlite through supertest, with a `MemoryMailer` and a clock they
can move, and pure helpers have unit tests next to them (`lib/time.test.ts`,
`modules/shifts/schedule.test.ts`). The web app has Vitest and Testing Library
specs next to the helpers and components in `apps/web/src/lib`. So rules worth
testing (time, eligibility, ordering) belong in a `service.ts` or a `lib/`
helper, not inside a route handler or a Svelte page. Most items add columns or
tables and bring a migration under `apps/api/src/db/migrations`, registered in
its `index.ts`, with the table types in `db/types.ts` updated to match. File
names below are relative to `apps/api/src/` unless they start with `apps/`,
`docs/` or `test/` (which means `apps/api/test/`).

When an item ships, its row in the overview says `Shipped` in the Group column,
its section moves under a `## Shipped` heading at the end of this file and
shrinks to one paragraph on what was built and what was left out, and the same
pull request updates the README, the notes under `docs/` and an `Unreleased`
entry in the [CHANGELOG](CHANGELOG.md).

"Depends on" lists real prerequisites only. Items that merely touch the same
file are not listed there; the bigger overlaps are mentioned in the items.

## Overview

| #   | Item                                       | Group | Area        | Size | Depends on |
| --- | ------------------------------------------ | ----- | ----------- | ---- | ---------- |
| 1   | Past shifts keep their hours               | Next  | correctness | S    | -          |
| 2   | Password reset                             | Next  | accounts    | S    | -          |
| 3   | Emails that failed are sent again          | Next  | email       | M    | -          |
| 4   | Sign-in limits behind the proxy            | Next  | security    | S    | -          |
| 5   | Scheduled backups and a restore guide      | Next  | ops         | S    | -          |
| 6   | Leaving without erasing the records        | Later | accounts    | M    | -          |
| 7   | Email preferences and unsubscribe links    | Later | email       | S    | -          |
| 8   | Moved shifts check their sign-ups again    | Later | shifts      | S    | -          |
| 9   | Waitlist offers close to the start         | Later | sign-ups    | M    | 3          |
| 10  | Cancellation cut-off and no-show follow-up | Later | sign-ups    | S    | -          |
| 11  | Handing a shift to someone else            | Later | sign-ups    | M    | -          |
| 12  | Group sign-ups                             | Later | sign-ups    | M    | -          |
| 13  | Recurring shifts                           | Later | shifts      | M    | -          |
| 14  | Sign-up questions per event                | Later | events      | M    | -          |
| 15  | Waivers and agreements                     | Later | events      | M    | -          |
| 16  | Skills that expire                         | Later | skills      | S    | -          |
| 17  | Guardian consent for young volunteers      | Later | accounts    | M    | 15         |
| 18  | Self check-in with a QR code               | Later | check-in    | M    | -          |
| 19  | Check-out and the hours really worked      | Later | hours       | M    | -          |
| 20  | Volunteers report their own hours          | Later | hours       | M    | -          |
| 21  | Certificates that can be verified          | Later | hours       | S    | -          |
| 22  | Messages to a shift or an event            | Later | email       | M    | 7          |
| 23  | A calendar feed to subscribe to            | Later | sign-ups    | S    | -          |
| 24  | Public event pages                         | Later | events      | M    | -          |
| 25  | Email verification on registration         | Later | accounts    | S    | -          |
| 26  | Personal data export                       | Later | accounts    | S    | -          |
| 27  | Reports by event, role and over time       | Later | reports     | M    | -          |
| 28  | Audit log of coordinator actions           | Later | ops         | M    | -          |
| 29  | Event leads                                | Later | roles       | L    | 28         |
| 30  | Accessibility pass                         | Later | ui          | M    | -          |
| 31  | Browser end-to-end tests                   | Later | tests       | M    | -          |
| 32  | Background jobs in their own process       | Later | ops         | S    | 3          |
| 33  | Metrics and a readiness check              | Later | ops         | S    | -          |
| 34  | Languages and date formats                 | Maybe | ui          | L    | -          |
| 35  | Faster with many events and volunteers     | Maybe | performance | M    | -          |
| 36  | Text message reminders through a gateway   | Maybe | email       | M    | 7          |
| 37  | Several organisations in one installation  | Maybe | platform    | L    | 29         |
| 38  | Offline check-in on a phone                | Maybe | check-in    | L    | 18         |

## Next

### 1. Past shifts keep their hours

`DELETE /api/shifts/:id` in `modules/shifts/routes.ts` deletes the shift row
whatever its date. `signups.shift_id` is `ON DELETE CASCADE`
(`0004_signups.ts`), and so is `hour_entries.signup_id` (`0007_hour_entries.ts`).
Deleting last month's shift to tidy up the schedule therefore removes every
sign-up on it and every hour credited by checking those people in. Their
yearly totals drop, their certificate changes and the hours report no longer
matches what was printed before. Nobody is told; the "shift removed" emails
only go out for future shifts. Roles are already protected (`role_in_use`),
shifts are not.

- Refuse deleting a shift that has started, with a `conflict` that says to
  cancel the event or leave the shift as history. Future shifts are deleted as
  today, with the emails.
- Same rule for `PATCH /api/shifts/:id` moving a past shift: changing the
  times of a shift people were checked in for silently changes nothing in
  `hour_entries` (the hours were credited at check-in), so the record and the
  hours would disagree. Refuse time changes once the shift has started; notes
  and capacity can still change.
- Change `hour_entries.signup_id` to `ON DELETE SET NULL`, so that if a
  sign-up ever goes (an account deletion, item 6), the hours stay with a
  description. The description already holds the event and role name
  (`creditShiftHours` writes `"<event>: <role>"`).
- `removeShiftHours` keys on `signup_id`; with `SET NULL` that still works for
  undoing a check-in, because the sign-up still exists then.
- Tricky: an entry with `signup_id` set cannot be deleted by hand
  (`credited_from_shift` in `modules/hours/routes.ts`). After `SET NULL` it
  becomes a manual entry that a coordinator can delete. That is acceptable and
  should be said in `docs/architecture.md`.
- Tests: in `test/shifts.test.ts`, deleting and moving a started shift is
  refused, a future one works; in `test/hours.test.ts`, the hours survive the
  sign-up being removed.

### 2. Password reset

There is no way back into an account after forgetting the password. The app
already sends email for everything else (SMTP through `mail/mailer.ts`,
Mailpit in compose), so a reset link is the obvious missing piece.

- Data: `password_resets` (`id` as the sha256 of the token, like `sessions`
  do with `hashToken`, `user_id`, `expires_at`, `used_at`). One hour, one use.
- `POST /api/auth/forgot` takes an email and always answers 204, whether the
  account exists or not. It is rate limited per email and per address with the
  existing `RateLimiter`.
- `POST /api/auth/reset` takes the token and a new password (same
  `MIN_PASSWORD_LENGTH`), sets it, marks the token used, and deletes every
  session of the user, as `POST /api/me/profile/password` already does for
  other devices.
- Web: "Forgot your password?" on `/login`, and a `/reset` page that reads
  the token from the link (`APP_URL` builds it, like the digest link does).
- A template in `mail/templates.ts`, with the HTML escaped like the others.
- Without `SMTP_URL` the log mailer would write the link to the log. That is
  fine for development but must not happen in production: log only that a
  reset was requested.
- Tests: in `test/auth.test.ts`, the email arrives in the `MemoryMailer` with a
  working link, the token works once, expires with the moved clock, unknown
  emails get the same 204, sessions are cleared.

### 3. Emails that failed are sent again

Sending is best effort: `sendSafely` logs the error and carries on. For most
emails that loses one message. For reminders it is worse: `sendDueReminders`
sets `reminder_sent_at` after `sendSafely` returns, whether it worked or not,
so a mail server that is down for ten minutes at the wrong time means nobody
on tomorrow's morning shifts is reminded, and the job never tries again. The
digest has the same shape: the `job_runs` row is claimed first, so a failed
send is gone for the day.

- Data: an `outbox` table (`id`, `to`, `subject`, `text`, `html`,
  `kind`, `created_at`, `attempts`, `next_attempt_at`, `sent_at`,
  `last_error`).
- `sendSafely` becomes "insert into the outbox" (inside the caller's
  transaction where there is one, so a rolled-back sign-up sends nothing), and
  a `deliverOutbox(ctx)` step in `modules/reminders/scheduler.ts` sends due
  rows with backoff (1, 5, 30 minutes, then hourly, giving up after a day).
- Requests that send mail today (sign-up confirmations) would wait for the
  next tick. Keep them fast by calling `deliverOutbox` right after the
  response for that message only, with the scheduler as the safety net.
- Reminders: mark `reminder_sent_at` when the outbox row is created; the
  outbox owns delivery from then on.
- A small coordinator page or a section on the home page: "3 emails could not
  be delivered", with the address and error, because a wrong address is
  something a coordinator can fix.
- Tricky: two API processes would both deliver. Claim rows with
  `FOR UPDATE SKIP LOCKED`. PGlite in tests runs one connection, which is
  fine for checking the logic.
- Tricky: old rows. Delete sent rows after 30 days in the same loop.
- Tests: `test/reminders.test.ts` with a mailer that fails once (the
  `MemoryMailer` can take a failure switch), the reminder arrives on the next
  tick, and a rolled-back sign-up leaves no outbox row.

### 4. Sign-in limits behind the proxy

`app.ts` sets `trust proxy` to `'loopback'`. In compose, nginx runs in the
`web` container and the API in `api`, so requests come from another address
on the Docker network and `req.ip` is nginx's address for everybody. The login
limiter keys on `` `${req.ip}:${input.email}` ``, so it still works per email,
but there is no limit per address across emails at all, and registration has
no limiter (anyone can create thousands of accounts, each of which is then
listed in the coordinators' directory).

- Configuration: `TRUST_PROXY` (default `loopback`, set in
  `docker-compose.yml` to the compose network or `1`), passed straight to
  `app.set('trust proxy', ...)` and documented in the README table.
- A second login limiter per address (say 50 failures in 15 minutes), next to
  the per-email one.
- A limiter on `/api/auth/register` per address (5 an hour) and on the reset
  route from item 2.
- Tricky: a whole food bank's volunteers may sign in from one hall's Wi-Fi
  on event day. Count failures only for the address limiter, never successes.
- Tests: `lib/rate-limit.test.ts` stays as is; `test/auth.test.ts` sets
  `X-Forwarded-For` with trust enabled and checks the per-address and
  registration limits.

### 5. Scheduled backups and a restore guide

All data lives in the `db-data` volume, and the README only says that
`docker compose down -v` removes it. For a nonprofit, the hours history is
often what grant reports and volunteer references are built on.

- A `backup` service in `docker-compose.yml` under a `backup` profile, using
  the same `postgres:17-alpine` image: `pg_dump -Fc` once a day into a
  `./backups` bind mount, named by date, deleting dumps older than
  `BACKUP_KEEP_DAYS` (default 30). Copying the folder off the machine is the
  operator's job; the doc says so.
- `docs/backups.md`: start it, take one by hand, restore into a fresh volume,
  check a dump with `pg_restore --list`.
- Upgrades: migrations run when the API starts (`migrateToLatest` in
  `index.ts`). The guide says to take a dump before pulling a new version,
  since rolling back a migration is not something I test.
- Tricky: restoring with the API running lets it migrate or seed a half
  restored database (`SEED_DEMO` seeds an empty one). Stop `api` first.
- Tests: none in Vitest. A CI step that runs the dump and restore commands
  against a throwaway Postgres service would prove them.
