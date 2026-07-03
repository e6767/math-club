# Math Club App

A website and member portal for a high school math club: public event/announcement
pages, member accounts with RSVP, and an officer/admin dashboard for managing
events, resources, and the member roster.

Built as a single Node.js app (Express + EJS + SQLite) — no separate frontend
build step, no external database to set up, one service to deploy.

## Features

- **Public pages** — home, upcoming/past events, announcements
- **Accounts for every member** — register/login, sessions, hashed passwords (bcrypt)
- **Member dashboard** — RSVP to events (going / maybe / can't go), browse resources
- **Officer & admin tools** — post announcements, create/edit/delete events, add
  resources, view who RSVP'd to an event
- **Admin-only roster page** — promote members to officer/admin, remove accounts
- The **first person to register automatically becomes an admin** — have your
  club's officer set up their account first.

## Tech stack

- Node.js (**22.5+ required** — uses the built-in `node:sqlite` module, so
  there's no native database dependency to compile or install)
- Express
- EJS templates (server-rendered HTML, no separate frontend build)
- express-session for login sessions
- bcryptjs for password hashing

## Running it locally

```bash
npm install
cp .env.example .env
npm start
```

Then open http://localhost:3000. Register your first account — it'll
automatically become an admin.

### Configuration (`.env`)

| Variable | What it does |
|---|---|
| `PORT` | Port to run on (default 3000) |
| `SESSION_SECRET` | Random string used to sign session cookies — **change this** before going live |
| `CLUB_NAME` | Shown in the header, page titles, and footer |
| `SCHOOL_EMAIL_DOMAIN` | If set (e.g. `lincolnhigh.edu`), registration is restricted to emails ending in `@lincolnhigh.edu`. Leave blank to allow any email. |

## Data storage

Everything is stored in a SQLite file at `data/mathclub.db`, created
automatically on first run. There's nothing else to provision — no external
database service needed. Back up that one file to back up the whole club's data.

Sessions currently use an in-memory store, which is fine for a club-sized
group but means everyone gets logged out if the server restarts. If that
becomes annoying, swap in a persistent session store (e.g. `express-session`'s
file store options) — ask me and I can wire that up.

## Deploying it

Any host that runs a persistent Node.js process works (this app keeps a
SQLite file on local disk, so it needs a host with persistent storage — not a
purely serverless/stateless platform).

**Render** (free tier friendly):
1. Push this project to a GitHub repo.
2. On Render: New → Web Service → connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add environment variables from `.env.example` in Render's dashboard.
5. Under "Disks," add a persistent disk mounted at `/opt/render/project/src/data`
   so the SQLite file survives restarts and deploys.

**Railway** works almost identically — connect the repo, set the same env vars,
add a volume for the `data/` folder.

Make sure whichever host you use runs **Node 22.5 or newer**, since the app
relies on the built-in `node:sqlite` module rather than an npm package that
needs compiling.

## Project structure

```
server.js              App entry point, session setup, top-level routes
db.js                   SQLite connection + schema (creates tables on first run)
middleware/auth.js      Login/role-check middleware
routes/                 auth, events, resources, announcements, admin
views/                  EJS templates
public/css/style.css    All styling
data/                   SQLite database file lives here (created automatically)
```

## Extending it

Some natural next steps if you want to keep building:
- Email notifications when a new announcement or event is posted
- A "problem of the week" submission feature with grading/leaderboard
- CSV export of the roster or attendance
- Password reset flow (currently there isn't one — an admin would need to
  manually help a member who's locked out, e.g. by removing and re-adding them)
