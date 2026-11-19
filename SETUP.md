# FIRM — Local setup on macOS

This guide gets the FIRM cycle app running on a fresh Mac, either against the
built-in embedded database (fastest) or a real PostgreSQL server.

FIRM is a Next.js 16 app for the **Sanghvi Movers Limited** crane-disposal cycle. It
moves Old Fleet, Non-Revenue Generating (NRG) and Non-Deployable cranes to
international rental, sale or scrap, with one owner per step, named approvals and an
SAP record for every exit. FP&A uploads a nine-column fleet Excel — the five crane
fields plus SAP Status, SO Number, SO Start Date and SO End Date; Sales and
Maintenance review every crane in parallel; Finance deduplicates the flags; Old
Fleet and NRG cranes are offered to international BUs before sale; Non-Deployable
cranes go straight to sale and then scrap if unsold. Everything runs locally — the
workflow data is stored in a JSON file and there is no live SAP connection, so the
four SAP columns are **entered manually** from the SAP system of record. In
production these fields are pulled automatically from SAP. SO End Date drives the
"Execution allowed from" rule: no new SO, deployment or handover before that date.

---

## 1. Prerequisites

| Tool | Version | Why |
| ---- | ------- | --- |
| macOS | 13 Ventura or newer | Intel or Apple Silicon both work |
| Node.js | **22 LTS** (20.9+ minimum) | Next.js 16 and PGlite |
| npm | Ships with Node | Dependency install |
| git | Any recent version | Clone the repo |
| Docker Desktop | Optional | Only for the PostgreSQL option |

Install Node with Homebrew or nvm:

```bash
# Homebrew
brew install node@22
brew link --overwrite --force node@22

# or nvm (recommended if you keep several Node versions)
brew install nvm
mkdir -p ~/.nvm
nvm install 22
nvm use 22
```

Verify:

```bash
node -v    # v22.x.x
npm -v     # 10.x or newer
```

> Avoid Node 18 and Node 23+. Next.js 16 needs a modern Node runtime, and the
> native PGlite package is tested against the LTS releases.

---

## 2. Get the code

```bash
git clone <REPOSITORY-URL> firm
cd firm
```

> **Before you clone:** this working copy has not been committed yet. Commit and
> push from the machine that has the current work first, or copy the folder over
> (excluding `node_modules`, `.next` and `.data`). The rest of this guide assumes
> a normal `git clone`.

Check what you have:

```bash
ls
# AGENTS.md  README.md  USAGE.md  SETUP.md  package.json  src  public  ...
```

---

## 3. Install dependencies

```bash
npm install
```

Use `npm ci` instead if you want an exact install from `package-lock.json`
(recommended on CI or a second machine):

```bash
npm ci
```

This installs Next.js, React 19, Tailwind v4, Radix primitives, Recharts,
TanStack Table, SheetJS (`xlsx`), Drizzle, and the embedded PGlite database engine.

> `npm audit` currently reports two high-severity advisories from transitive
> dependencies. They do not block local use. Review them before a production
> deployment.

---

## 4. Configure the environment

```bash
cp .env.example .env.local
```

Generate a session secret and paste it into `.env.local`:

```bash
openssl rand -base64 48
```

`.env.local` for the default embedded database:

```dotenv
# Leave empty to use the embedded PGlite database in ./.data/pglite
DATABASE_URL=

# Optional: where the embedded database lives
# PGLITE_DIR=./.data/pglite

# Required in shared environments; any long random string works locally
SESSION_SECRET=<paste-the-openssl-output-here>
```

Notes:

- `.env.local` is git-ignored. Never commit it.
- Environment changes require a dev-server restart.
- With `DATABASE_URL` empty, the app creates `.data/pglite` on first connection for
  user accounts and sessions.
- The FIRM workflow data (cycles, cranes, checks, quotes, approvals and audit) is
  stored separately in **`.data/firm-workflow.json`** and is seeded automatically
  on first run — no import step and no seed script needed.

---

## 5. First run

There is nothing to import or seed. On first start the app creates
`.data/firm-workflow.json` and fills it with demonstration workflow data: an open
FIRM cycle, a fleet of cranes spread across the 20 statuses, BU quotes, sale and
scrap cases, approvals and reminders.

Start the app:

```bash
npm run dev
```

Open **http://localhost:3100**. Sign in on `/login` with one of the demo accounts
below.

### Demo accounts

All demo accounts use the password **`Firm@12345`**.

| Role | Email | Password |
| ---- | ----- | -------- |
| FP&A | `fpna@firm.local` | `Firm@12345` |
| Sales | `sales@firm.local` | `Firm@12345` |
| Maintenance | `maintenance@firm.local` | `Firm@12345` |
| Finance | `finance@firm.local` | `Firm@12345` |
| Strategy | `strategy@firm.local` | `Firm@12345` |
| International BU | `bu@firm.local` | `Firm@12345` |
| Marketing | `marketing@firm.local` | `Firm@12345` |
| SCM | `scm@firm.local` | `Firm@12345` |
| CBO | `cbo@firm.local` | `Firm@12345` |
| CSO | `cso@firm.local` | `Firm@12345` |
| MD | `md@firm.local` | `Firm@12345` |
| Global Administrator | `admin@firm.local` | `Firm@12345` |

These accounts are for evaluation only. Change the passwords and
`SESSION_SECRET` before sharing the app with anyone.

---

## 6. Where the workflow data lives

The app uses a JSON-backed workflow store at **`.data/firm-workflow.json`**:

| Directory / file | Contents |
| ---------------- | -------- |
| `.data/firm-workflow.json` | Cycles, cranes, flags, Sales/Maintenance checks, BU quotes, awards, catalogue, sale and scrap quotes, claim-backs, conflicts, approvals and audit entries. Created automatically on first run. |
| `.data/pglite` | Embedded database for user accounts and signed sessions (used only when `DATABASE_URL` is empty). |

You can edit the workflow data by using the app (uploads, checks, approvals,
claim-backs and conflict decisions all write to the JSON file). The file is
git-ignored. To start over, delete it and restart — see Section 10.

---

## 7. Production build on the Mac

```bash
npm run typecheck
npm run build
npm start
```

`npm start` serves the production build on **http://localhost:3100**. The build
uses Next.js standalone output, so it can also be containerised with the included
`Dockerfile`. The workflow JSON store must be writable by the process at runtime.

---

## 8. Optional: use real PostgreSQL

### Option A — Docker Compose

The repo includes a Postgres 16 service:

```bash
docker compose up -d db
```

Then in `.env.local`:

```dotenv
DATABASE_URL=postgres://firm:firm@localhost:5432/firm
```

Restart the dev server. The user accounts are created automatically on first
connection. FIRM workflow data still lives in `.data/firm-workflow.json`.

### Option B — Homebrew Postgres

```bash
brew install postgresql@16
brew services start postgresql@16
createdb firm
```

```dotenv
DATABASE_URL=postgres://$(whoami)@localhost:5432/firm
```

The embedded `.data/pglite` directory is simply ignored when `DATABASE_URL` is
set; the workflow JSON store is unaffected.

---

## 9. Everyday commands

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Dev server on port 3100 with hot reload |
| `npm run build` | Production build |
| `npm start` | Serve the production build on 3100 |
| `npm run typecheck` | TypeScript check, no emit |

---

## 10. Reset the local workflow data

**Stop the dev server first**, then delete the workflow JSON file:

```bash
rm -rf .data/firm-workflow.json
npm run dev
```

The app recreates and re-seeds the demonstration cycle, cranes, quotes and
approvals on the next start. To also reset user accounts, stop the server and
remove the embedded database directory:

```bash
rm -rf .data/pglite
npm run dev
```

For PostgreSQL, drop and recreate the database instead:

```bash
dropdb firm && createdb firm
npm run dev
```

---

## 11. Troubleshooting on macOS

**Port 3100 is already in use**

```bash
lsof -ti:3100 | xargs kill -9
```

**`EPERM`, `EBUSY` or stale-chunk errors under `.next`**

```bash
rm -rf .next
npm run dev
```

**PGlite fails to open the data directory**

- Keep the project on the local disk, not iCloud Drive, Dropbox, a network
  share, or an external volume.
- Make sure the folder is writable: `ls -ld .data`.
- Delete and let it re-seed if the directory was copied mid-write.

**`npm install` fails on Apple Silicon**

- Confirm you are on Node 22 LTS (`node -v`).
- Remove a partial install and retry: `rm -rf node_modules && npm ci`.
- If you are behind a corporate proxy, configure `npm config set proxy` and
  `npm config set https-proxy`.

**Sign-in immediately bounces back to `/login`**

- Check that `.env.local` exists and the dev server was restarted.
- Sessions last 12 hours and are signed with `SESSION_SECRET`. Changing the
  secret invalidates existing cookies; clear cookies for `localhost:3100`.
- Make sure the user accounts exist (they are created on first connection).

**Workflow data looks stale or missing**

- Stop the dev server, remove `.data/firm-workflow.json`, and start again — see
  Section 10. The file is recreated with fresh demo data on first run.

**Excel upload rejects a workbook**

- The upload template has **nine columns**: Equipment ID, Equipment Description, YOM,
  Yield %, Utilisation %, SAP Status, SO Number, SO Start Date and SO End Date. A row
  with a blank field goes back to FP&A.
- There is no SAP connection in this build, so the four SAP columns are entered
  manually from the SAP system of record. In production they are pulled automatically
  from SAP. SO End Date drives the "Execution allowed from" rule.
- Do not add flag, category or price columns: the app derives the age and Old Fleet
  flag from YOM.
- Download the blank template or sample fleet from `/import` if unsure of the format.

---

## 12. What lives where

```
src/
  app/
    login/                 sign-in
    (app)/                 authenticated shell + pages
      page.tsx             dashboard (current cycle and crane counts)
      cranes/              crane register and crane detail
      cycles/              FIRM cycles and cycle detail
      approvals/           approval queue
      import/              nine-column fleet upload (5 crane + 4 SAP fields)
      roles/               12 FIRM roles and responsibilities
      settings/            workflow and application settings
    actions/               server actions (auth, workflow, approvals)
    api/                   template download, CSV export, health
  components/              shared UI (badges, tables, dialogs, shell)
  db/                      Drizzle schema, DDL, connection + user seed
  lib/
    firm/                  workflow domain: roles, 20 statuses, dedup rules,
                           approval matrix, conflict rules, JSON-backed store
    auth.ts                sessions and password hashing
    excel.ts               nine-column workbook parser
    api.ts                 typed data facade
public/
  brand/sml-logo.png       Sanghvi Movers Limited logo
  templates/               downloadable upload template and sample fleet
  icon.png                 browser favicon (logo)
.data/
  firm-workflow.json       workflow store, seeded automatically on first run
  pglite/                  embedded database (users and sessions)
scripts/                   utility scripts
USAGE.md                   functional source of truth (business process)
AGENTS.md                  notes for AI coding agents working in this repo
```

### Template files

| File | Purpose |
| ---- | ------- |
| `public/templates/FIRM-Fleet-Upload-Template.xlsx` | Blank nine-column upload template: Equipment ID, Equipment Description, YOM, Yield %, Utilisation %, SAP Status, SO Number, SO Start Date, SO End Date. |
| `public/templates/FIRM-Sample-Fleet.xlsx` | Worked example of a fleet upload. |

### Routes

| Route | Purpose |
| ----- | ------- |
| `/login` | Sign in (first sign-in opens the guide) |
| `/welcome` | First-login guide — reopen from the Help button any time |
| `/` | Dashboard — current cycle, crane counts, approvals, conflicts and reminders |
| `/cranes` | Crane register with filters and search |
| `/cranes/[id]` | Full crane record, checks, quotes, approvals and audit trail |
| `/cycles` | FIRM cycles |
| `/cycles/[id]` | One cycle's cranes and progress |
| `/approvals` | Decisions waiting on your role |
| `/import` | Upload the nine-column fleet Excel (5 crane + 4 SAP fields) |
| `/roles` | The 12 FIRM roles |
| `/settings` | Workflow and application settings |

---

## 13. Verification checklist

After setup, walk these in order:

1. `/login` signs in with `fpna@firm.local` / `Firm@12345`.
2. `/` shows the current FIRM cycle and crane counts by status and layer.
3. `/cranes` lists the seeded fleet; filter by status and open a crane detail.
4. `/cranes/[id]` shows the crane's flags, Sales/Maintenance checks, SAP data
   ("Execution allowed from"), quotes, approvals and audit trail.
5. `/cycles` lists the cycle; `/cycles/[id]` shows its cranes.
6. `/approvals` shows decisions queued for your role.
7. `/import` offers `FIRM-Fleet-Upload-Template.xlsx` and `FIRM-Sample-Fleet.xlsx`,
   and shows the nine upload columns (five crane fields plus SAP Status, SO Number,
   SO Start Date and SO End Date, entered manually in this build).
8. `/roles` lists all 12 FIRM roles and their responsibilities.
9. `/settings` shows the workflow settings.
10. `npm run typecheck` passes.

Every authenticated page shows the banner
**"Confidential. Sanghvi Movers Limited. Internal use only."**

---

## 14. Before you push

`node_modules/`, `.next/`, `.data/` and `.env.local` are git-ignored. Commit the
source, `package.json` and `package-lock.json`; never commit the workflow JSON
store, the database directory, build output or secrets.
