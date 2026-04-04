# volunteer-shifts

Volunteer shift scheduling for food banks, festivals and other nonprofits.
Coordinators split events into shifts with roles and capacity; volunteers
sign up, join waitlists and build up a log of their hours.

## Quick start

```sh
docker compose up -d --build
```

Open http://localhost:4420 and sign in with one of the demo accounts
(password `demo-password`):

- `coordinator@example.org`: plans events, manages rosters and checks people in
- `volunteer@example.org`: signs up for shifts

## Local development

Requires Node 22 and a PostgreSQL database.

```sh
npm install
docker compose up -d db          # or point DATABASE_URL at your own Postgres
npm run dev -w apps/api          # http://localhost:4000
npm run dev -w apps/web          # http://localhost:5173, proxies /api
```

Run the checks with `npm run lint`, `npm run typecheck` and `npm test`.
The API tests use an in-memory PGlite database, so they don't need Postgres.
