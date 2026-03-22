# Seller Find

Seller outreach MVP built from the planning documents in `C:\SellerFind\SellerOutreachMVP`.

## Workspace
- `C:\SellerFind\SellerOutreachMVP`: product and execution documents
- `C:\SellerFind\apps\web`: Next.js web app
- `C:\SellerFind\apps\api`: NestJS API
- `C:\SellerFind\packages\db`: Prisma schema and DB package
- `C:\SellerFind\scripts`: Windows helper scripts and embedded PostgreSQL scripts

## Current MVP Scope
- Campaign settings CRUD
- Instagram discovery runs for public candidate collection, preview, and import
- Lead list, detail, create, score recalculation
- Lead detail editing for profile, contact, status, CRM stage, and notes
- Lead detail actions for adding/removing contacts and adding tracked posts
- Review queue with approve, hold, and do-not-contact decisions
- Outreach queue with preview, approve, send email, and queue DM
- Outreach safety checks for approval required, duplicate send prevention, and DO_NOT_CONTACT blocking
- Outreach approval confirmation with operator note support
- CRM board with reply logging, stage moves, and activity notes
- Onboarding list, detail, start, and update
- Dashboard and audit log views
- CSV/Excel import for leads with preview editing, mapping templates, and import history

## Run Locally
1. Install dependencies
```bash
npm install
```

2. Check env files
- `C:\SellerFind\apps\web\.env.local`
- `C:\SellerFind\apps\api\.env`
- Add Instagram discovery env values in `apps/api/.env` when you want live Meta API collection:
  - `INSTAGRAM_ACCESS_TOKEN`
  - `INSTAGRAM_USER_ID`
  - `INSTAGRAM_API_VERSION`

3. Run web
```bash
npm run dev:web
```

4. Run API
```bash
npm run dev:api
```

Quick start by double-click
- Double-click [start-seller-find.cmd](C:\SellerFind\start-seller-find.cmd) to open the API and web dev servers in separate windows.
- The launcher also opens the browser to [http://localhost:3000](http://localhost:3000).

5. Generate Prisma client
```bash
npm run db:generate
```

6. Push Prisma schema
```bash
npm run db:push
```

## Embedded PostgreSQL Mode
Use this mode when you want a local PostgreSQL-compatible database without a separate admin install.

1. Start embedded DB
```bash
npm run db:start:embedded
```

2. Push schema into embedded DB
```bash
npm run db:push:embedded
```

3. Run API against embedded DB
```bash
npm run dev:api:embedded
```

Default connection details
- Host: `127.0.0.1`
- Port: `5432`
- User: `postgres`
- Password: `postgres`
- Database: `seller_find`

## Data Storage Mode
- If `DATABASE_URL` is empty in `apps/api/.env`, the API uses JSON fallback files.
- If `DATABASE_URL` is set, the API uses Prisma with PostgreSQL first.
- `ENABLE_DEV_SEED=false` disables demo seed insertion when you run against a real PostgreSQL database.
- The dashboard now shows the active storage mode so you can quickly confirm whether you are using `DATABASE` or `JSON_FALLBACK`.

## Lead CSV Import
You can now import leads from the Leads page by either:
- pasting CSV text into the `CSV import` panel
- selecting a local `.csv` file
- selecting a local `.xlsx` or `.xls` file

Duplicate protection
- Manual lead creation now blocks duplicate `handle` values inside the same campaign.
- Manual lead creation also blocks duplicate `contactValue` values inside the same campaign.
- CSV and Excel import skip duplicate or invalid rows and continue importing the rest.
- You can preview import results before saving from the Leads page.
- Detected CSV or Excel headers can be mapped to supported lead fields before preview/import.
- Column mappings can be saved as reusable local templates from the Leads page.
- Preview rows can edit `campaignId`, `platform`, `handle`, `displayName`, `category`, `followerCount`, `postCount`, `bio`, and `contactValue` before re-running preview or importing.
- Preview rows can also be filtered by `READY` or `SKIP`, and unwanted rows can be removed before import.
- Duplicate rows in preview can now be switched between `SKIP` and `OVERWRITE`.
- Duplicate rows in preview can also use `MERGE` to fill only missing data on an existing lead.
- Import history is available from the Leads page and records file name, template name, import counts, overwrite counts, and merge counts.
- Import validation now checks required fields, supported `platform` values, email format, and outlier numeric ranges for followers and posts.

Supported columns
- `handle`
- `displayName`
- `platform`
- `category`
- `followerCount`
- `postCount`
- `bio`
- `contactValue`
- `campaignId`

Template file
- Use [lead-import-template.csv](C:\SellerFind\lead-import-template.csv) as a ready-to-fill import template.

Example
```csv
handle,displayName,platform,category,followerCount,contactValue
@sample_handle,Sample Seller,INSTAGRAM,K-Beauty,12000,sample@example.com
```

API endpoint
- `POST /api/leads/import-csv`
- `GET /api/leads/import-history`
- `PATCH /api/leads/:id`
- `POST /api/leads/:id/contacts`
- `DELETE /api/leads/:id/contacts/:contactId`
- `POST /api/leads/:id/posts`

## Instagram Discovery
Use the Discovery page to run manual Instagram discovery batches per campaign.

What it does
- reads `HASHTAG`, `SEED_ACCOUNT`, and `KEYWORD` campaign sources from Settings
- stores a discovery run and candidate preview in PostgreSQL
- lets the operator review candidates and choose `SKIP`, `OVERWRITE`, or `MERGE`
- imports approved candidates into the existing lead pipeline

Current limits
- Discovery requires PostgreSQL mode and is disabled in JSON fallback mode.
- `KEYWORD` sources are stored and shown in run results, but v1 treats them as manual enrichment hints rather than live Instagram API search.
- `dryRun=true` uses mock candidates and does not call the Meta API.

Discovery env
- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_USER_ID`
- `INSTAGRAM_API_VERSION`

Discovery endpoints
- `POST /api/discovery/instagram/campaigns/:id/run`
- `GET /api/discovery/runs`
- `GET /api/discovery/runs/:runId`
- `GET /api/discovery/runs/:runId/candidates`
- `POST /api/discovery/runs/:runId/import`

## Operator Prep
- The dashboard includes a local operator profile panel for `name` and `role`.
- Current role handling is a lightweight groundwork step: `VIEWER` is treated as read-only in write-heavy UI actions.
- Operator names are passed with lead updates, imports, and outreach actions so audit logs can start capturing ownership.

## Notes
- Root scripts use `C:\SellerFind\scripts\run-npm.cmd` and workspace scripts use `C:\SellerFind\scripts\run-with-npm-node.cmd` to avoid PATH issues inside Codex.
- The API allows `http://localhost:3000` as the default local origin.
