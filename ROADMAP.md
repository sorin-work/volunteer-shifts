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

## Later

### 6. Leaving without erasing the records

Deleting an account (`DELETE /api/me/profile`) deletes the user row, and
everything cascades: sessions, skills, sign-ups and hour entries. The comment
in `modules/profile/routes.ts` says coordinators should export reports first,
but the volunteer decides when to leave, not the coordinator. Last year's
hours report and the turnout numbers of past events change the day someone
deletes their account.

- Deleting becomes anonymising: name to "Former volunteer", email to a
  unique placeholder (`deleted-<id>@invalid`), phone and birth date cleared,
  password hash replaced with an unusable value, sessions and skills deleted,
  future sign-ups cancelled (which promotes the waitlist and tells the
  coordinators, as a normal cancellation does). Past sign-ups and hours stay.
- `users.deleted_at` so the directory and searches can leave such rows out,
  and so the email can be registered again.
- The hours report and rosters show "Former volunteer" and the totals stay.
- Tricky: the waitlist promotion for each cancelled future sign-up has to run
  per shift with the same locks as a normal cancel; reuse the cancel service
  rather than updating rows directly.
- Undecided: a real erase on request (some volunteers will ask for it under
  data protection law). A coordinator action "erase completely" that does
  what deletion does today, with a warning about the reports, covers it.
- Tests: in `test/profile.test.ts`, the account cannot sign in, its past hours
  still count in `test/reports.test.ts`, future sign-ups are cancelled and the
  waitlist moves.

### 7. Email preferences and unsubscribe links

Every coordinator gets the daily digest (`sendCoordinatorDigest` selects all
users with `role = 'coordinator'`), and every volunteer gets reminders, with no
way to turn either off short of deleting the account. Bulk senders are also
expected to include a one-click unsubscribe header now, and the messages in
item 22 would make that more pressing.

- Data: `email_prefs` on `users` as a few booleans: `reminders`, `digest`,
  `announcements` (for item 22). Confirmations, cancellations and changes to a
  shift you are on are always sent; they are part of the service.
- Settings page: the switches.
- Every optional email gets a signed unsubscribe link (HMAC of user id and
  kind with a server secret, so no table) and the `List-Unsubscribe` and
  `List-Unsubscribe-Post` headers. `POST /api/unsubscribe` needs no session.
- Configuration: `APP_SECRET` for the signature, required in production.
- Tricky: a coordinator who turns off the digest and is the only one. Show a
  note on the settings page rather than forbidding it.
- Tests: digest skips opted-out coordinators, reminder skips opted-out
  volunteers, the link works without a session and refuses a tampered
  signature.

### 8. Moved shifts check their sign-ups again

When a coordinator changes a shift's times (`PATCH /api/shifts/:id`), the
confirmed volunteers get a "shift moved" email and their reminder is reset.
Nothing checks the rules sign-up enforced: the new time may overlap another
shift the volunteer has (`findConflicts`), or move the shift to a day before
their birthday for a role with a minimum age (`assertEligible`). Changing the
role of a shift has the same problem with required skills.

- After the update, run the same checks for each confirmed and waitlisted
  sign-up, using the functions in `modules/signups/service.ts` and
  `eligibility.ts`.
- Don't cancel anyone automatically. Return the problems in the response
  (`affected: [{ signupId, name, problem }]`), show them on the manage page,
  and let the coordinator decide. The volunteer's "moved" email mentions the
  clash so they can cancel one side.
- Tricky: the overlap check runs per user and shift; for a shift with 50
  people that is 50 queries. Fine at this size; one query with a join would do
  if it ever matters.
- Tests: in `test/shifts.test.ts`, moving a shift onto another of the same
  volunteer reports the clash, changing the role to one with a skill reports
  the missing skill, and nothing is cancelled.

### 9. Waitlist offers close to the start

Promotion is automatic and immediate: `promoteFromWaitlist` confirms the
first waitlisted person when a spot opens and emails them. If someone cancels
at 23:00 for a 07:00 shift, the promoted person is "confirmed" while asleep,
the roster counts them, and they become a no-show that the recent no-show
flags then hold against them.

- Within `WAITLIST_OFFER_HOURS` (say 24) of the start, promotion becomes an
  offer: the sign-up gets status `offered` with an `offer_expires_at`, the
  email has accept and decline links, and the spot is held until it expires
  (a few hours, or the shift start minus an hour). Then it goes to the next
  person. Outside that window, promotion stays automatic.
- The scheduler loop expires offers. Item 3's outbox makes the emails
  reliable; an offer that never arrives is worse than today's behaviour.
- `countConfirmed` has to count held offers as taken, or capacity
  overflows.
- Tricky: a new status touches every place that filters on
  `status in ('confirmed', 'waitlisted')`, starting with `findConflicts` and
  the rosters. List them before starting.
- Undecided: whether to offer to everyone on the waitlist at once and take
  the first to accept. Faster to fill, less fair; I lean towards one at a
  time.
- Tests: `test/waitlist.test.ts` with the clock moved: offer inside the
  window, automatic outside, expiry hands it on, accept and decline.

### 10. Cancellation cut-off and no-show follow-up

Volunteers can cancel until the shift starts. Cancellations within
`LATE_CANCELLATION_HOURS` (24, in `modules/attendance/routes.ts`) show up on
the roster as late, and no-shows are flagged, but nothing happens with either.

- An optional `cancel_cutoff_hours` per event. Inside it, the cancel button
  becomes "Tell the coordinator", which cancels and emails the event's
  creator, so someone can find a replacement. Cancelling is never blocked: a
  volunteer who cannot come should not be forced to stay signed up.
- After a no-show is marked, an optional friendly email ("we missed you,
  everything all right?"), off by default.
- Volunteer profile: late cancellations next to no-shows in the stats.
- Tests: cut-off email in `test/signups.test.ts`, stats in
  `test/volunteers.test.ts`.

### 11. Handing a shift to someone else

A volunteer who cannot make it can only cancel and hope the waitlist moves.
Often they already know someone who would take it.

- "Offer to someone" on a sign-up: enter the email of another registered
  volunteer, who gets a link to accept. On accept, in one transaction with the
  shift locked, the original sign-up is cancelled and a new confirmed one is
  created for the other person, skipping the waitlist.
- The new person passes the same rules as a sign-up (`assertEligible`,
  `findConflicts`); otherwise the offer cannot be accepted and the page says
  why.
- Offers expire at the shift start and can be withdrawn.
- Tricky: skipping the waitlist is the point, but it can look unfair to the
  people waiting. Let coordinators turn handovers off per event.
- Tests: accept swaps the sign-ups, an ineligible person cannot accept,
  expired and withdrawn offers fail.

### 12. Group sign-ups

Families, school groups and company volunteer days sign up together today one
account at a time, and the last ones often end up on the waitlist.

- A sign-up for N spots by one account (`party_size` on `signups`, default
  1), with the names of the others as free text. Only for roles without a
  minimum age or skills, because the app cannot check people without
  accounts.
- `countConfirmed` sums `party_size`; the capacity check and the waitlist
  promotion work in spots, not rows. A group is promoted only when the whole
  group fits, and people behind it can move past it in the meantime.
- Coordinators can set a maximum group size per event (0 turns it off).
- Hours: the account holder gets their own hours; the others are not
  credited, since they have no account. The roster shows "+3".
- Tricky: the promotion order rule above is a real change to "first come
  first served". Write it down in the docs.
- Tests: capacity and waitlist with groups in `test/waitlist.test.ts`.

### 13. Recurring shifts

Food banks run the same shifts every week. Today that is "copy a day's
schedule" (`POST /api/events/:id/shifts/copy`) once per week, or a new event
per week with "duplicate event".

- "Repeat weekly until" on the shifts editor: creates the shifts for each
  week up to an end date (at most a year), in the event's time zone with the
  same local times, using `lib/time.ts` so DST changes keep 09:00 at 09:00.
- A `series_id` on `shifts` so that editing or deleting can apply to "this
  and following" shifts in the series.
- No rule engine (every second Tuesday, except holidays). Weekly with an end
  date covers the common case; skipped dates can be deleted one by one.
- Tricky: editing "this and following" times on a series where some shifts
  already have sign-ups runs item 8's checks for each of them.
- Tests: `modules/shifts/schedule.test.ts` for the dates across a DST change,
  `test/shifts.test.ts` for series edits.

### 14. Sign-up questions per event

Coordinators often need one or two things per event: T-shirt size, dietary
needs for the volunteer lunch, "can you bring a car?". Today that goes by
separate email or a form elsewhere.

- Data: `event_questions` (`event_id`, `label`, `kind` text, choice or yes/no,
  `options`, `required`) and `signup_answers` (`signup_id`, `question_id`,
  `value`).
- Asked once per event on the first sign-up for any of its shifts, editable
  later from "My shifts".
- Answers on the roster, the roster CSV and the event's sign-up export, plus a
  count per option on the event summary (how many T-shirts in L).
- Duplicating an event copies the questions.
- Tricky: questions added after people signed up. They are asked the next time
  the volunteer opens the event; the roster shows "not answered".
- Tests: answers required on sign-up, copied on duplicate, in the CSV.

### 15. Waivers and agreements

Many organisations need volunteers to accept a liability waiver, a code of
conduct or a photo consent before they work. Nothing in the app records that.

- Data: `agreements` (`title`, `body`, `version`, `required_for` all events
  or chosen events) and `agreement_acceptances` (`user_id`, `agreement_id`,
  `version`, `accepted_at`, `ip`).
- Signing up for a shift of an event that needs an agreement the volunteer
  has not accepted (in its current version) shows it first, and the API
  refuses with a clear code, the way `assertEligible` does for skills.
- A new version asks again; old acceptances are kept.
- Coordinators see who accepted what on the roster.
- Tricky: this is a record, not a legal signature. Say so in the docs.
- Tests: sign-up refused until accepted, a new version asks again, a
  coordinator adding someone to a shift sees the warning.

### 16. Skills that expire

Skills like "Food hygiene" or "First aid" are confirmed by a coordinator
after seeing a certificate (`PUT /api/volunteers/:id/skills`), and they last
forever. Most of those certificates expire after one to three years.

- Data: `expires_on` on `user_skills` (nullable) and `default_valid_months`
  on `skills`.
- `assertEligible` and `eligibilityProblem` treat a skill as missing when it
  expires before the shift's local date.
- The volunteer's profile and the directory show "expires in 30 days"; the
  digest mentions skills that expire in the next month for volunteers with
  upcoming shifts that need them.
- Tricky: the skills editor replaces the whole set (`DELETE` then `INSERT`).
  It has to keep the dates of skills that did not change.
- Tests: `test/eligibility.test.ts` with an expired skill on the shift date,
  editor keeps dates.

### 17. Guardian consent for young volunteers

Roles can have a minimum age, checked against the birth date on the day of the
shift. Many organisations accept 14 to 17 year olds only with a parent's
consent, and the app has no notion of it.

- `minor_age` in settings (default 18). A volunteer under it on the shift day
  needs a guardian consent on file for that role's events.
- The consent is an agreement (item 15) accepted by the guardian: the
  volunteer enters a guardian email, the guardian gets a link and accepts
  without an account. Stored with the guardian's name and email.
- Coordinators see "consent on file" on the roster.
- Depends on item 15.
- Tricky: birth dates are optional unless a role has a minimum age. A
  volunteer without one is treated as adult here, as they are today.
- Tests: sign-up refused for a minor without consent, allowed after the
  guardian accepts, adults unaffected.

### 18. Self check-in with a QR code

Check-in is done by a coordinator on the roster, one tap per person, from an
hour before the start (`CHECK_IN_OPENS_MINUTES`). At a festival gate with 40
people arriving at once, that coordinator is the queue.

- Per shift, a check-in code shown as a QR code on the coordinator's phone
  or printed on the roster: a random token that is valid only between the
  check-in opening and the shift end. A volunteer scans it, signs in if
  needed, and is checked in through the same `markAttendance` service, with
  `attendance_marked_by` set to themselves.
- The QR code is drawn in the browser from the URL (a small library or a
  hand-written encoder); no service.
- Coordinators can still correct anything on the roster.
- Tricky: a photo of the code sent to a friend lets them check in from home.
  Rotate the code every few minutes on the coordinator's screen; a printed
  code is a choice the coordinator makes.
- Tests: check-in through the code inside and outside the window, wrong
  shift, rotation.

### 19. Check-out and the hours really worked

Checking in credits the scheduled length of the shift (`creditedHours` in
`modules/hours/credit.ts`). People who leave early or stay two hours longer to
help pack up get the same hours, and coordinators fix it with a manual entry,
if at all.

- An optional "check out" on the roster, which sets `checked_out_at` and
  replaces the credited hours with the time between check-in (or the shift
  start, whichever is later) and check-out, rounded to the quarter hour.
- Events choose: scheduled hours (today) or checked hours.
- Without a check-out, the scheduled hours stay.
- Tricky: the hour entry is unique per sign-up (`0011_hour_entries_signup_unique.ts`),
  so check-out updates the row rather than adding one. `removeShiftHours`
  stays correct.
- Tests: `modules/hours/credit.test.ts` for the rounding and the earliest
  start, route tests for check-out updating the entry.

### 20. Volunteers report their own hours

Hours come from check-ins or from coordinators (`POST /api/volunteers/:id/hours`
is coordinator only). Work done off-site (phone calls, baking for the sale,
driving) is only counted if a coordinator types it in.

- Volunteers submit hours with a date, amount and description; the entry is
  `pending` until a coordinator approves or rejects it with a note.
- Data: `status` (`approved`, `pending`, `rejected`) and `reviewed_by` on
  `hour_entries`; every existing row is `approved`.
- Totals, certificates and reports count approved hours only; the volunteer
  sees pending ones separately.
- A "hours to review" count on the coordinator home page and in the digest.
- Tests: pending hours are not on the certificate, approval adds them,
  rejection keeps the note, volunteers cannot approve.

### 21. Certificates that can be verified

The yearly certificate is a PDF with the organisation's name
(`ORG_NAME`), the volunteer's name and the hours. Schools and employers who
receive one cannot tell whether it is real.

- Each certificate carries a short code and a URL
  (`APP_URL/verify/<code>`) printed on it. The code is an HMAC of the user id,
  year and hours, so the page can confirm "this certificate for this name and
  number of hours was issued by this organisation", and nothing else.
- The verify page needs no sign-in and shows only the name, year and hours,
  and whether the hours have changed since.
- Tricky: hours change after the certificate was downloaded (a late manual
  entry). The page says "the current total is X" rather than failing.
- Uses `APP_SECRET` from item 7.
- Tests: a valid code verifies, a changed one fails, the page shows nothing
  more than it should.

### 22. Messages to a shift or an event

Coordinators can't write to the people on a shift from the app. The roster
has email addresses, so they copy them into a mail program, which leaks
addresses when someone forgets to use Bcc.

- "Message volunteers" on the roster and on the event's manage page: subject
  and text, sent to every confirmed (and optionally waitlisted) person, one
  email each, through the outbox from item 3.
- A log of sent messages per event, so other coordinators can see what was
  said.
- Plain text only, with the app's footer and the unsubscribe link for
  announcements from item 7 (messages about a shift you are on are not
  announcements).
- Rate limit per coordinator, to make mistakes small.
- Tests: recipients chosen right, opted-out people skipped for announcements,
  the log.

### 23. A calendar feed to subscribe to

Volunteers can download one `.ics` file per sign-up
(`GET /api/signups/:id/calendar.ics`). A changed or cancelled shift leaves a
stale entry in their calendar.

- A personal feed URL with a random token (`calendar_token` on `users`,
  regenerated on request): `GET /api/calendar/<token>.ics` returns every
  upcoming confirmed shift, built with `toIcs` in `lib/ics.ts`, with stable
  `UID`s so calendar apps update entries in place.
- Cancelled shifts are left out (or sent with `STATUS:CANCELLED` for a few
  days, which some clients honour).
- Coordinators can get a feed for an event's shifts.
- Tricky: the feed works without a session, so the token is the only
  protection; it must be long, revocable and not logged (pino-http logs the
  URL, so mask it in the serializer).
- Tests: the feed lists the right shifts, a regenerated token makes the old
  URL 404, cancelled shifts disappear.

### 24. Public event pages

Every route under `/api/events` needs a session (`router.use(requireAuth)` in
`modules/events/routes.ts`). To see which shifts a festival needs, someone
first has to register. That is the step where most would-be volunteers stop.

- A public, read-only view of published events: name, description,
  location, the roles and the shifts with open spots, but no names of who
  signed up. "Sign up" sends to registration and back to the shift.
- Per event, `public` (default off), so internal events stay internal.
- `GET /api/public/events` and `/api/public/events/:id`, with their own small
  DTOs, never the internal ones, so a field added later does not leak.
- Tricky: the web app is a static SvelteKit build with `ssr = false`, so
  search engines and link previews see an empty shell. An nginx rule could
  serve a tiny prerendered page per event later; not in the first version.
- Tests: draft and non-public events are not listed, no personal data in the
  response.

### 25. Email verification on registration

Anyone can register with any address and sign up for shifts at once. A
mistyped address means the person never gets confirmations or reminders, and
nobody notices until they do not show up.

- `email_verified_at` on `users`. After registering, a link is sent; until it
  is clicked, the account can browse but not sign up for shifts, and the
  event page says why.
- Existing accounts are marked verified in the migration.
- Coordinators adding someone to a shift bypass it, as they do for capacity.
- Changing the email (not possible today) would need the same step.
- Tests: sign-up refused before verification, allowed after, link single use.

### 26. Personal data export

A volunteer can see their shifts and hours in the app but cannot take the
data with them, and data protection law in many places gives them that right.

- `GET /api/me/export` returns a JSON file with the profile, skills,
  sign-ups (with event, role, times and attendance) and hour entries.
- A button on the settings page, next to account deletion.
- Tests: the file contains only the user's own rows.

### 27. Reports by event, role and over time

The only report is hours per volunteer for a year (`hoursReport` in
`modules/reports/routes.ts`), plus a turnout summary per event. Grant
applications and annual reports usually ask for more: hours per event or
programme, new volunteers per month, how many came back.

- Hours by event and by role for a date range, with CSV.
- Volunteers per month: active (at least one attended shift), new (first
  attended shift that month), returning.
- Fill rate and no-show rate per event over time.
- All dates in the event's time zone, as hours already are.
- Plain tables first; a chart only if it is cheap.
- Tests: `test/reports.test.ts` with a small fixture across two years.

### 28. Audit log of coordinator actions

Several coordinators share full power: they change roles, confirm skills,
check people in, log and delete hours, and cancel events. When a volunteer
asks why their hours changed, there is no answer.

- Data: `audit_log` (`actor_id`, `action`, `subject_type`, `subject_id`,
  `detail` JSON, `created_at`).
- Written in the same transaction as the change, for: role changes, skill
  changes, attendance changes, manual hours added and deleted, shifts and
  events deleted, cancelled or moved, people added to shifts by a coordinator.
- A page for coordinators with filters by volunteer and by event, and a
  section on the volunteer's profile.
- Tests: each action writes one row with the right actor, nothing is written
  when the change fails.

### 29. Event leads

There are two roles, `coordinator` and `volunteer`, and coordinators can do
everything to every event. Larger organisations want a team lead who runs the
check-in for the Saturday market without being able to promote people or see
every volunteer's details.

- Data: `event_leads` (`event_id`, `user_id`). A lead can manage shifts,
  rosters and check-ins for their events only.
- `requireCoordinator` becomes a check on the event: coordinators pass, leads
  pass for their events. Every route under events, shifts, attendance and
  signups that takes an event or shift id needs the event-level check. This is
  the bulk of the work and the part to test most.
- Leads see contact details only of people on their shifts.
- The audit log from item 28 records who did what, which matters more once
  more people have power.
- Tests: a lead can check in on their event and is refused on another,
  cannot see the directory or change roles.

### 30. Accessibility pass

Volunteers are of every age and many use the app on a phone, sometimes with
large text or a screen reader. No one has gone through it that way. Likely
gaps from reading the code:

- Status badges (`StatusBadge.svelte`) and fill rates rely on colour.
- The roster's check-in buttons need labels that include the person's name,
  not only "Check in".
- Error messages from the API (`signup-errors.ts`) should be announced in a
  live region.
- Focus after actions: signing up removes the button the focus was on.
- Contrast and touch target size on the event page.
- Tests: Testing Library specs for labels and focus; an automated axe check
  would need item 31.

### 31. Browser end-to-end tests

The API tests use supertest and PGlite, and the web tests render components
in jsdom. Nothing checks the real build against the real API through nginx:
the cookie being set on the right path, the proxy, the print view.

- Playwright in `apps/web/e2e`, against the compose stack with
  `SEED_DEMO=true`. A few flows: register and sign up, waitlist and promotion,
  coordinator checks someone in, certificate download, email in Mailpit (its
  API lists messages).
- A separate CI job after the image builds.
- Tricky: the demo data is relative to today. Assert on structure, not on
  counts.

### 32. Background jobs in their own process

`startReminderLoop` runs inside the API process, and `docs/architecture.md`
says to move it if the API is ever scaled out. With two API containers the
reminders would be sent twice: `sendDueReminders` selects due rows and then
updates them, without a claim.

- An `apps/api/src/worker.ts` entry point that runs the loop, and a `worker`
  service in compose with the same image; the API stops running the loop when
  `RUN_JOBS=false`.
- Claim reminder rows with an `UPDATE ... RETURNING` on
  `reminder_sent_at IS NULL` instead of select-then-update, so even two
  workers cannot double-send. The digest already claims through `job_runs`.
- Depends on item 3, which moves sending into the outbox and gives the
  worker one job to own.
- Tests: two reminder runs at once send each reminder once.

### 33. Metrics and a readiness check

`/api/health` checks the database and pino logs every request. For whoever
runs this for an organisation, a few numbers would help: request rate and
errors, email failures, reminder runs and how long they take.

- `/api/metrics` in Prometheus text format, off unless enabled, not proxied
  by nginx. Route templates as labels, not raw URLs.
- `/api/ready` that also checks that migrations are at the latest version
  and the mailer can connect, separate from liveness.
- Tests: disabled by default, counters move after a request.

## Maybe

### 34. Languages and date formats

Everything is in English, and dates are formatted with a fixed `en-GB`
locale, both in the web app (`apps/web/src/lib/format.ts`) and on the
certificate (`issuedOn` in `modules/certificates/routes.ts`). Food banks and
festivals often have volunteers who would rather read another language.

- Web: a message catalogue per language and a language switch; `Intl`
  formats from the chosen locale. Svelte 5 needs no library for this, a typed
  dictionary is enough.
- Emails: templates in `mail/templates.ts` per language, chosen by a
  `language` column on `users`.
- The certificate in the volunteer's language.
- Why Maybe: every string in the app and every email has to go through it,
  and each language needs someone to keep it up to date. Date formats alone
  (a `locale` setting) are an S and could be split out.
- Tests: a check that every key exists in every catalogue; templates render
  in each language.

### 35. Faster with many events and volunteers

The demo has a few events and two dozen volunteers. A few places would slow
down with years of data:

- `GET /api/shifts/understaffed` loads every upcoming shift with its count
  and filters and sorts in JavaScript.
- The event page loads all shifts of an event with their sign-ups; a
  festival with 400 shifts is a big response for a phone.
- The hours report scans all hour entries of the year, which is fine, and
  the volunteer profile sums all hours ever, also fine.
- What would help: the understaffed filter in SQL (`HAVING count < capacity`)
  and shifts on the event page by day. The indexes are mostly there already:
  `signups (shift_id, status)` in `0009_signup_indexes.ts` and
  `shifts (starts_at)` in `0013_shift_start_index.ts`.
- Why Maybe: I have no reason to think anyone has this much data yet. Measure
  with a seeded fixture before changing anything, and assert on query counts,
  not timing.

### 36. Text message reminders through a gateway

Email reminders are easy to miss; volunteers often ask for a text message the
day before. The app stores a phone number already.

- An optional SMS sender next to the mailer, configured by URL, that speaks to
  a self-hosted gateway (an Android phone running an SMS gateway app, or
  `gammu-smsd` with a modem) over HTTP. No account with a commercial provider
  is required; one could be added behind the same interface.
- Per user opt-in (item 7), for reminders and last-minute changes only.
- Why Maybe: phone numbers are free text today and would need checking and a
  country code; delivery costs money even self-hosted; and a gateway is one
  more thing to run.
- Tests: the sender interface with a fake, opt-in respected.

### 37. Several organisations in one installation

Each installation serves one organisation (`ORG_NAME` is an environment
variable). Several small groups sharing one server, or a volunteer centre that
serves many charities, would need organisations as data.

- An `organisations` table; events, skills and roles belong to one; users can
  belong to several with a role in each.
- Every query that today filters by nothing would filter by organisation.
- Why Maybe: that is every query in the app, and getting one wrong leaks one
  organisation's volunteers to another. Separate installations are simpler and
  safer, and compose makes them cheap. Item 29 is the smaller step that solves
  most of the "different teams" need.

### 38. Offline check-in on a phone

At outdoor events the signal is often poor, and the roster needs a connection
for every check-in.

- An installable app (the web manifest exists, `static/manifest.webmanifest`)
  with a service worker that keeps the rosters of today's shifts and queues
  check-ins while offline, sending them when the connection returns.
- The server accepts a `checked_in_at` from the queue, within limits (not in
  the future, not before the check-in window).
- Why Maybe: two coordinators checking in offline on two phones can disagree,
  and the merge rule (first wins, last wins, ask) needs care. Item 18's
  self check-in also needs a connection, on the volunteer's own phone.
- Tests: the queue and replay as a pure module with specs; server limits on
  `checked_in_at`.
