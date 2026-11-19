# FIRM — Crane Cycle Workflow

An internal app for **Sanghvi Movers Limited** that runs the FIRM cycle: it moves
**Old Fleet**, **Non-Revenue Generating (NRG)** and **Non-Deployable** cranes to
international rental, sale or scrap, with one owner per step, named approvals and an
SAP record for every exit.

FIRM starts when FP&A uploads a nine-column fleet Excel: Equipment ID, Equipment
Description, YOM, Yield %, Utilisation %, SAP Status, SO Number, SO Start Date and
SO End Date. Because this build has **no SAP connection**, the four SAP fields are
entered manually from the SAP system of record; in production they are pulled
automatically from SAP. Sales and Maintenance review every crane in parallel, Finance
deduplicates the flags, Old Fleet and NRG cranes are offered to international BUs
before sale, and Non-Deployable cranes go straight to sale and then scrap if unsold.
A crane leaves the cycle only when SAP records its exit — an SO or an international
asset transfer. After that, nobody can claim it back.

There is no live SAP connection in this build: SAP/SO details are entered manually in
the upload from the SAP system of record (they are pulled automatically from SAP in
production) and later SAP references are recorded in the workflow. See
[USAGE.md](USAGE.md) for the full business process and [SETUP.md](SETUP.md) for local
setup.

---

## What it does

- **Nine-column fleet upload** — FP&A uploads Equipment ID, Equipment Description,
  YOM, Yield %, Utilisation %, SAP Status, SO Number, SO Start Date and SO End Date.
  Age and the Old Fleet flag are derived from YOM. With no SAP connection in this
  build, the four SAP fields are entered manually from SAP; in production they are
  pulled automatically. SO End Date sets "Execution allowed from".
- **Parallel Sales + Maintenance checks** — every crane gets a marketability / NRG
  check from Sales and a Deployable / Non-Deployable check from Maintenance at the
  same time, with the Global Administrator chasing missing submissions.
- **Finance deduplication** — Non-Deployable wins; otherwise Old Fleet beats NRG;
  otherwise the crane is Not in FIRM. Overrides require a written reason and the
  original flags stay visible.
- **International rental first** — Strategy floats Old Fleet and NRG cranes to all
  international BUs at once (20-day window), evaluates quotes and awards a crane with
  Strategy Head / CSO sign-off, then deploys it through an SAP asset transfer.
- **Catalogue, sale and scrap** — Marketing gets a 5-working-day catalogue window;
  SCM gathers domestic and international quotations in a 60-day sale window; unsold
  cranes go to management for a scrap decision.
- **Claim-back and conflicts** — before an SO exists, Sales or the International team
  can claim a crane back. Competing rental and sale deals pause at S14 with a
  3-working-day decision by CBO, CSO or Strategy (CEO if CBO and CSO disagree), and a
  15-day limit to execute.
- **Governed approvals** — Finance Head, Strategy Head, CSO, CBO and MD approve the
  hand-offs in the approval matrix; every decision is recorded with name, date and
  comments in the audit trail.
- **20-status tracking** — every crane has exactly one of 20 statuses (S01–S20)
  across Active, Approval, On Hold, Locked and Closed layers, with an
  "Execution allowed from" date from the current SAP SO end date.
- **Dashboard and register** — cycle progress, counts by status and layer, approvals,
  conflicts, reminders, searchable crane list and full per-crane detail.

---

## Tech stack

| Layer | Choice |
| ----- | ------ |
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Workflow store | JSON-backed store at `.data/firm-workflow.json`, seeded automatically on first run |
| Database | PostgreSQL via Drizzle ORM |
| Local DB | Embedded PGlite (PostgreSQL in WASM) — zero install, for users and sessions |
| UI primitives | Radix UI |
| Excel | SheetJS (`xlsx`) |
| Auth | Signed, HTTP-only session cookie (HMAC-SHA256) |

Set `DATABASE_URL` to use a real PostgreSQL server, or leave it empty to use the
embedded PGlite database in `./.data/pglite`. FIRM workflow data is stored
independently in the JSON file.

---

## Quick start

Requirements: **Node.js 20.9+** (Node 22 recommended) and npm.

```bash
npm install
cp .env.example .env.local   # then set SESSION_SECRET (see SETUP.md)
npm run dev
```

Open <http://localhost:3100> and sign in. On first run the app creates and seeds
`.data/firm-workflow.json` with a demonstration cycle, cranes, quotes, approvals and
reminders — no import or seed command is needed.

### Demo credentials

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

Seeded accounts are for evaluation only. Change the passwords and
`SESSION_SECRET` before any shared deployment.

---

## Environment variables

Copy `.env.example` to `.env.local` and adjust as needed.

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `DATABASE_URL` | No | PostgreSQL connection string. Empty = embedded PGlite. |
| `PGLITE_DIR` | No | Directory for the embedded database (default `./.data/pglite`). |
| `SESSION_SECRET` | Recommended | HMAC key for session cookies. Set a long random value in shared environments. |

User accounts and sessions are created automatically on first connection. The FIRM
workflow store at `.data/firm-workflow.json` is created and seeded automatically on
first run; delete that file (with the dev server stopped) to reset the demo data.

---

## Routes

| Route | Purpose |
| ----- | ------- |
| `/login` | Sign in (first sign-in opens the guide) |
| `/welcome` | First-login guide to the workflow, roles, statuses and screens |
| `/` | Dashboard — current cycle, crane counts by status and layer, approvals, conflicts and reminders |
| `/cranes` | Crane register with filters and search |
| `/cranes/[id]` | Full crane record — flags, checks, SAP data, quotes, approvals, conflicts and audit trail |
| `/cycles` | FIRM cycles |
| `/cycles/[id]` | One cycle's cranes and progress |
| `/approvals` | Decisions waiting on your role |
| `/import` | Upload the nine-column fleet Excel (5 crane + 4 SAP fields) to start a cycle |
| `/roles` | The 12 FIRM roles and their responsibilities |
| `/settings` | Workflow and application settings |

Every authenticated page shows:
**"Confidential. Sanghvi Movers Limited. Internal use only."**

---

## Using the app

1. **Start a cycle** (`/import`) — FP&A uploads the nine-column workbook (five crane
   fields plus the four SAP fields). Blank fields are rejected. Age and the Old Fleet
   flag are derived automatically; the SAP fields are entered manually in this build
   because SAP is not connected.
2. **Parallel checks** — Sales records marketability, NRG and expected deployment
   duration; Maintenance records Deployable / Non-Deployable and a reason. Both
   teams review the full fleet at the same time.
3. **Dedup** — Finance assigns one final category per crane (Section 4 of USAGE.md).
4. **International rental** — Strategy offers Old Fleet and NRG cranes to all BUs,
   evaluates quotes and awards a crane with the required sign-off, then deploys it by
   SAP asset transfer.
5. **Catalogue and sale** — Marketing uploads the catalogue; SCM gathers quotations;
   FP&A validates price and management approves; a sale SO is created in SAP.
6. **Scrap or close** — unsold cranes go to management for scrap approval, then a
   scrap sale SO; Finance closes exited cranes and updates the asset register.

### Upload template

The workbook has exactly nine columns — the five crane fields (Equipment ID,
Equipment Description, YOM, Yield %, Utilisation %) plus four SAP fields (SAP Status,
SO Number, SO Start Date, SO End Date). The app derives age and the Old Fleet flag
from YOM. **This build has no SAP connection**, so the four SAP fields are entered
manually from the SAP system of record; in production they are pulled automatically
from SAP. The SO End Date is shown as **"Execution allowed from"**: no new SO,
deployment or handover happens before it.

Templates are available in `public/templates/`:

| File | Purpose |
| ---- | ------- |
| `FIRM-Fleet-Upload-Template.xlsx` | Blank nine-column upload template (5 crane + 4 SAP fields) |
| `FIRM-Sample-Fleet.xlsx` | Worked example of a fleet upload |

---

## Project structure

```
src/
  app/
    (app)/               authenticated pages: dashboard, cranes, cycles, approvals,
                         import, roles, settings
    api/                 template download, CSV export, health
    actions/             server actions: auth, workflow, approvals
    login/               sign-in page
  components/            UI: sidebar, badges, tables, dialogs, shell
  db/                    Drizzle schema, DDL, PGlite/Postgres initialiser, user seed
  lib/
    firm/                workflow domain: roles, 20 statuses, dedup rules, approval
                         matrix, conflict rules, JSON-backed store
    auth.ts              sessions and password hashing
    excel.ts             nine-column workbook parser
    api.ts               typed data facade
public/
  brand/sml-logo.png     Sanghvi Movers Limited logo
  icon.png               browser favicon
  templates/             upload template and sample fleet
.data/
  firm-workflow.json     workflow store (auto-seeded on first run)
  pglite/                embedded database (users and sessions)
scripts/                 utility scripts
USAGE.md                 business process and functional source of truth
SETUP.md                 local setup guide
```

---

## Scripts

| Script | Description |
| ------ | ----------- |
| `npm run dev` | Development server on port 3100. |
| `npm run build` | Production build. |
| `npm start` | Start the production server on port 3100. |
| `npm run typecheck` | TypeScript check without emitting. |

Workflow demo data needs no script — it is seeded on first run into
`.data/firm-workflow.json`.

---

## Production with PostgreSQL

```bash
export DATABASE_URL=postgres://firm:firm@localhost:5432/firm
export SESSION_SECRET="$(openssl rand -hex 32)"
npm run build
npm start
```

The user accounts are created automatically on first connection. Point
`DATABASE_URL` at a managed PostgreSQL instance for a durable deployment; PGlite is
intended for local use and demos. Ensure `.data/firm-workflow.json` is writable by
the app process (or reset it with the server stopped).

### Docker

```bash
docker compose up --build
```

This starts PostgreSQL and the app on <http://localhost:3100>. Override
`SESSION_SECRET` (and the database credentials) for anything beyond a local demo.

---

## Notes & assumptions

- The 20 crane statuses, 12 roles, dedup table, approval matrix and conflict rules in
  this app come from the FIRM Business Process Document; USAGE.md is the readable
  reference.
- "Execution allowed from" is the SO End Date entered in the upload from SAP —
  manually in this build, automatically in production. It is shown on every crane and
  gates any new SO, deployment or handover.
- This build has no live SAP connection. SAP Status, SO Number, SO Start Date and SO
  End Date are entered manually in the upload; later SAP references (asset transfer,
  sale SO, scrap SO) are recorded in the app. SAP remains the hard stop: once an SO or
  international asset transfer is recorded, a crane cannot be claimed back and
  Finance closes it out of the cycle.
- Password hashing uses scrypt and sessions are signed, HTTP-only cookies.
