# volunteer-shifts

Volunteer shift scheduling for food banks, festivals and other nonprofits.
Coordinators split events into shifts with roles and capacity; volunteers sign
up, join waitlists, get reminders and build up a log of their hours with a
yearly certificate.

## Features

- **Events, roles and shifts**: draft and publish events in their own time
  zone, add roles (with a minimum age and required skills) and shifts with a
  capacity. Overnight shifts, copying a day's schedule and duplicating a whole
  event for next year are supported.
- **Sign-up rules**: volunteers can't take overlapping shifts, roles check age
  on the day of the shift and coordinator-confirmed skills, and full shifts put
  people on a waitlist that moves up automatically, first come first served.
- **Check-in**: coordinators get a roster with contact details, check people
  in from an hour before the start, mark no-shows and see late cancellations.
  Rosters print cleanly and export to CSV.
- **Hours**: checking in credits the shift's hours; coordinators can log extra
  time by hand. Volunteers see yearly totals and download a PDF certificate per
  year. Coordinators get a yearly hours report (also as CSV).
- **Email**: sign-up confirmations, waitlist notices and promotions, reminders
  the day before, cancellations, and a morning digest of understaffed shifts
  for coordinators. In docker compose everything lands in Mailpit.
- **Accounts**: volunteers register themselves; coordinators can promote
  others. Session cookies, rate-limited sign-in, profile, password change and
  account deletion.

## Quick start

```sh
docker compose up -d --build
```

| What            | URL                   |
| --------------- | --------------------- |
| App             | http://localhost:4420 |
| Mailpit (email) | http://localhost:8025 |

The first start seeds demo data. Sign in with password `demo-password`:

| Email                     | Role                                             |
| ------------------------- | ------------------------------------------------ |
| `coordinator@example.org` | coordinator: plans events, rosters and check-ins |
| `volunteer@example.org`   | volunteer with past hours and upcoming shifts    |

There are also two dozen other volunteers (`<first>.<last>@example.org`, same
password). Ports can be changed with `WEB_PORT`, `MAILPIT_PORT` and `DB_PORT`.
To start over: `docker compose down -v`.

## Local development

Requires Node 22 and PostgreSQL (the compose `db` service works fine).

```sh
npm install
docker compose up -d db mailpit
export DATABASE_URL=postgres://volunteer:volunteer@localhost:5432/volunteer_shifts
export SMTP_URL=smtp://localhost:1025 SEED_DEMO=true
npm run dev -w apps/api          # http://localhost:4000
npm run dev -w apps/web          # http://localhost:5173 (proxies /api)
```

Migrations run when the API starts; `npm run migrate -w apps/api` and
`npm run seed -w apps/api` run them by hand.

## Configuration

The API reads these environment variables (see `.env.example`):

| Variable                    | Default                                                          | Description                                           |
| --------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| `PORT`                      | `4000`                                                           | API port                                              |
| `DATABASE_URL`              | `postgres://volunteer:volunteer@localhost:5432/volunteer_shifts` | PostgreSQL connection string                          |
| `APP_URL`                   | `http://localhost:4420`                                          | Public URL used in email links                        |
| `SMTP_URL`                  | (unset)                                                          | SMTP server; without it emails are only logged        |
| `MAIL_FROM`                 | `Volunteer Shifts <no-reply@volunteer-shifts.local>`             | Sender address                                        |
| `ORG_NAME`                  | `Riverside Community Volunteers`                                 | Name printed on certificates                          |
| `SESSION_TTL_HOURS`         | `336`                                                            | How long a sign-in lasts                              |
| `BCRYPT_ROUNDS`             | `10`                                                             | Password hashing cost                                 |
| `REMINDER_LEAD_HOURS`       | `24`                                                             | Remind volunteers this long before a shift            |
| `REMINDER_INTERVAL_MINUTES` | `10`                                                             | How often the reminder job runs (`0` turns it off)    |
| `DIGEST_HOUR_UTC`           | `7`                                                              | Hour (UTC) after which the coordinator digest is sent |
| `SEED_DEMO`                 | `false` (`true` in compose)                                      | Seed demo data into an empty database on start        |
| `LOG_LEVEL`                 | `info`                                                           | pino log level                                        |

## Tests

```sh
npm test            # API (Vitest + supertest on in-memory PGlite) and web (Vitest + Testing Library)
npm run lint
npm run format:check
npm run typecheck
npm run build
```

The API tests run real SQL against PGlite (Postgres compiled to WebAssembly),
so no database server is needed. CI runs all of the above and builds both
Docker images.

## Project layout

```
apps/
  api/                 Express 5 + Kysely API
    src/
      db/              connection, migrations, table types
      lib/             time zones, ages, csv, ics, errors, validation helpers
      mail/            mailer and email templates
      modules/         auth, events, roles, shifts, signups, attendance,
                       hours, certificates, reports, reminders, digest, ...
      seed/            demo data
    test/              API tests and the PGlite test dialect
  web/                 SvelteKit (Svelte 5) single-page app, served by nginx
    src/lib/           api client, session, formatting, components
    src/routes/        pages
docs/                  API reference and architecture notes
docker-compose.yml     db, api, web and mailpit
```

## License

MIT, see [LICENSE](LICENSE).
