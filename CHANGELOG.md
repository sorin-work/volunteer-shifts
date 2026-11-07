# Changelog

## 1.0.0 (2026-11-07)

First stable release.

### Events and shifts

- Events with their own time zone, drafts, publishing and cancellation.
- Roles with a minimum age, required skills and a description.
- Shifts entered in local time, overnight shifts, copying a day's shifts and
  duplicating whole events.
- Search, upcoming/past/drafts tabs and date ranges on the events list.

### Sign-ups

- Sign up, cancel and join a waitlist that promotes people in order.
- Overlapping shifts, minimum age on the day of the shift and required skills
  are enforced; the event page explains why a shift can't be taken.
- Coordinators can add people to a shift.
- Calendar (.ics) download for upcoming shifts.

### Coordinators

- Rosters with contact details, check-in, no-shows, recent no-show flags and
  late cancellations; print view and CSV export.
- Understaffed shifts and fill rates on the home page, turnout summaries per
  event, sign-up export per event.
- Volunteer directory with search, profiles, skills and role changes.
- Yearly hours report with CSV export.

### Hours

- Hours credited on check-in in the event's time zone, manual entries,
  yearly totals and a PDF certificate per year.

### Email

- Confirmations, waitlist notices and promotions, reminders before shifts,
  changed and removed shifts, event cancellations and a daily digest of
  understaffed shifts. Mailpit catches everything in docker compose.

### Platform

- Express 5 + Kysely API on PostgreSQL, SvelteKit (Svelte 5) web app.
- Session cookies, sign-in rate limiting, security headers, request ids.
- Docker compose with health checks, demo data, CI for lint, format, types,
  tests, build and Docker images.

### Fixes since the first previews

- Sign-ups could overfill a shift when two arrived together.
- Volunteers could cancel other people's sign-ups.
- Overlap detection missed shifts that started earlier.
- Ages were worked out from the birth year only.
- The newest person on a waitlist was promoted instead of the first.
- Renaming a role cleared its minimum age.
- HTML in event descriptions was rendered.
- Evening shifts on 31 December counted towards the next year.
- Double check-ins credited hours twice.
- Waitlisted people got reminders.
- The last page of the volunteer directory was unreachable.
- Emails were case-sensitive at sign-in.
