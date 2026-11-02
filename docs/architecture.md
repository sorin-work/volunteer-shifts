# Architecture notes

## Overview

```
browser ──> nginx (web container, :80)
              ├─ /            SvelteKit static build (single-page app)
              └─ /api/*  ──>  api container (:4000, Express 5)
                                 ├─ PostgreSQL (Kysely, pg)
                                 └─ SMTP (Mailpit in compose)
```

The web app is a static SvelteKit build with `ssr = false`; nginx serves
`index.html` for every route and proxies `/api` to the API, so the browser
only ever talks to one origin and the session cookie can be `SameSite=Lax`
and `HttpOnly`.

## API

- `src/app.ts` builds the Express app from an `AppContext`
  (`db`, `config`, `logger`, `mailer`, `now`). Everything that has side
  effects comes in through the context, which is what makes the tests simple:
  they build a context with an in-memory database, a `MemoryMailer` and a
  clock they can move.
- Each feature lives in `src/modules/<name>` with its routes, DTO mappers and
  (where the logic is worth isolating) a `service.ts`.
- Errors are thrown as `HttpError` and turned into
  `{ error: { code, message, details } }` by one error handler. Validation uses
  zod; field messages end up in `details.fields`.

### Time

Shifts are stored as `timestamptz` instants. Each event has an IANA time zone,
and coordinators enter shifts as a local date and wall-clock times.
`lib/time.ts` converts between the two with `Intl` only (no date library),
handling DST gaps and overlaps. Anything that is "a day" from a person's point
of view (age on the day of a shift, the date hours are credited to, the date
shown in emails) uses the event's time zone, never UTC.

### Concurrency

Sign-ups, waitlist promotion and check-in run in a transaction that first
locks the shift (or signup) row with `SELECT ... FOR UPDATE`. That keeps
capacity and credited hours correct when two requests arrive at once. A
partial unique index allows one active sign-up per person and shift, and
another allows one hour entry per sign-up.

### Background jobs

`modules/reminders/scheduler.ts` runs every `REMINDER_INTERVAL_MINUTES` inside
the API process. It sends due shift reminders (marking `reminder_sent_at`) and
the daily coordinator digest (claimed through the `job_runs` table so it is
sent once per day even across restarts). If the API is ever scaled out, move
this loop into its own process.

### Email

`mail/mailer.ts` has an SMTP mailer (nodemailer), a log-only mailer used when
`SMTP_URL` is unset, and an in-memory mailer for tests. Sending is best effort:
failures are logged, never returned to the user. Templates escape every
interpolated value in the HTML part.

## Tests

API tests use [PGlite](https://pglite.dev) through a small Kysely dialect in
`test/pglite-dialect.ts`. PGlite has a single connection, so the dialect hands
it out one query (or one transaction) at a time; that is enough to exercise
the locking code paths. Each test file gets its own database and truncates the
tables before each test.

The web tests run in jsdom with Testing Library for components and plain unit
tests for the helpers in `src/lib`.

## Adding a migration

1. Add `apps/api/src/db/migrations/00NN_<name>.ts` with `up` (and `down`).
   Migrations take `Kysely<any>` because they run against the schema as it was
   at that point, not the current types.
2. Register it in `apps/api/src/db/migrations/index.ts`. The list is explicit
   so the same migrations run from tsx, the compiled build and the tests.
3. Update the table interfaces in `apps/api/src/db/types.ts`.
4. The API applies pending migrations on start; tests apply them to every
   fresh PGlite database.
