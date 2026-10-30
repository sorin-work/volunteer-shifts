# Troubleshooting

**`docker compose up` fails with "port is already allocated"**
Something else uses 4420, 8025 or 5432. Pick other ports:
`WEB_PORT=8080 MAILPIT_PORT=18025 DB_PORT=15432 docker compose up -d`.

**No demo accounts / "Email or password is incorrect"**
Demo data is only created when the database has no users. If you started
with `SEED_DEMO=false` or registered someone first, reset with
`docker compose down -v` and start again.

**Emails don't arrive**
In docker compose all mail goes to Mailpit at http://localhost:8025, nothing
is delivered to real inboxes. When running the API on its own, set
`SMTP_URL` (for example `smtp://localhost:1025` with Mailpit); without it the
API only logs a line per email.

**Reminders were not sent**
The reminder job runs every `REMINDER_INTERVAL_MINUTES` and picks up confirmed
sign-ups for shifts starting within `REMINDER_LEAD_HOURS`. Each sign-up is
reminded once; moving a shift to a new time resets that. Waitlisted people are
not reminded.

**A shift shows the wrong time**
Shift times are entered and shown in the event's time zone (shown on the
event page), not the browser's. Check the event's time zone on its manage
page.

**"Check-in opens … before the shift starts"**
Coordinators can check people in from `CHECK_IN_OPENS_MINUTES` (default 60)
before the start. No-shows can only be marked once the shift has started.

**Signed out unexpectedly**
Sessions last `SESSION_TTL_HOURS` (two weeks by default). Changing your
password signs out every other device.

**Tests fail with "Cannot find module @electric-sql/pglite"**
Run `npm install` from the repository root; the workspaces share one
`node_modules`.
