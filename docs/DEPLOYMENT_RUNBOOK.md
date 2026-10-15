# Deployment Runbook — Corporate Event / Conference Management System

**Status of this runbook:** the checkboxes below reflect what was
**actually executed and observed in this development sandbox** during
Phase 14. This system has **not** been deployed to a real cloud/production
environment — no deployment credentials or external hosting access exist
in this sandbox. Every item below is either a real, executed local
verification (marked PASS/FAIL) or explicitly marked
`NOT TESTED — ENVIRONMENT LIMITATION` where a real deployment would be
required to test it. Nothing here is a claim of "100% production ready,"
"100% secure," or "bug free."

---

## Phase 15 (Email Verification) — Deployment Steps

Do these **in this order** so existing employees are never locked out without a way to get a code:

1. Choose a provider. Render **free** web services block outbound SMTP on ports 25/465/587 (since Sept 2025): use `EMAIL_PROVIDER=brevo` + `EMAIL_API_KEY`, or an SMTP relay on port **2525**. Paid instances can use any SMTP port.
2. Verify the sender address/domain with the provider; set `EMAIL_FROM` to it.
3. Render → backend service → **Environment**: add `EMAIL_PROVIDER`, `EMAIL_FROM` and either `EMAIL_HOST`/`EMAIL_PORT`/`EMAIL_SECURE`/`EMAIL_USER`/`EMAIL_PASSWORD` (smtp) or `EMAIL_API_KEY` (brevo). Optionally `EMAIL_VERIFICATION_SECRET`. **Never** in GitHub, never in the frontend service. With `NODE_ENV=production` the backend refuses to start if email is not configured.
4. Deploy the backend, then run `npm run migrate:up` (applies `1700000000011_add-email-verification` and `1700000000012_enable-rls-email-verification-codes`: admins become verified, existing employees must verify once; no other data changes).
5. Redeploy the frontend (new `/verify-email` page).
6. Smoke test: register a real address you control → receive the code → verify → log in. Log in as admin (must work without a code). Check the backend logs contain no codes.
7. Tell existing employees they'll be asked to verify their email once at next sign-in. For anyone whose mailbox can't receive the code: `npm run verify:user -- <email>` from a local checkout whose `backend/.env` `DATABASE_URL` points at the production database (Render's Shell is not available on the free instance type).

Rollback: `npm run migrate:down` (drops `email_verification_codes` and the two `users` columns) and redeploy the previous backend/frontend.

## Pre-Deployment Checklist

- [x] PASS — `backend/.env.example` exists and contains placeholders only (verified: no real secret values, grepped for known patterns)
- [x] PASS — No `.env` file present in the packaged ZIP (verified by extracting the ZIP and searching for it)
- [x] PASS — `npm audit` reports 0 vulnerabilities in both `backend` and `frontend`
- [x] PASS — Frontend production build succeeds with 0 errors (`npm run build`, 725 modules)
- [x] PASS — Backend starts successfully with `npm start` given complete, valid environment variables
- [x] PASS — Backend refuses to start (exits 1, clear message) when a required environment variable is missing — verified live by unsetting `JWT_SECRET`
- [x] PASS — Backend refuses to start in `NODE_ENV=production` if a secret still holds its exact `.env.example` placeholder value — verified live

## Environment Configuration

- [x] PASS — All required variables enumerated and documented (README §16.3): `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DATABASE_URL` (migrations), `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL`
- [x] PASS — Optional variables with safe defaults documented: `PORT`, `NODE_ENV`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS`, `RATE_LIMIT_*`
- [x] PASS (Phase 15) — Email variables documented (README §17, `backend/.env.example` placeholders only): `EMAIL_PROVIDER`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_REQUIRE_TLS`, `EMAIL_API_KEY`, `EMAIL_FROM`, `EMAIL_VERIFICATION_SECRET`; required in production
- [x] PASS — `VITE_API_BASE_URL` documented as a **build-time** frontend variable (confirmed live: it's baked into the JS bundle, not read at runtime)
- [x] PASS — No environment variable was invented that the application doesn't actually read — every entry above was confirmed against actual source code usage

## Database Migration

- [x] PASS — Full migration chain (9 migrations) run against a **brand-new, throwaway** PostgreSQL database (`corporate_event_db_migration_test`), created and dropped solely for this test — the real development database was never touched
- [x] PASS — All 9 migrations completed successfully, in order
- [x] PASS — Post-migration schema verified: 8 tables (7 domain tables + `pgmigrations`), 3 enum types, 7 `updated_at` triggers, 12 foreign keys, 37 indexes
- [x] PASS — Single-step rollback (`npm run migrate:down`) verified live: rolled back the certificates migration, confirmed the table was dropped and the migration row removed
- [x] N/A — Multi-step/point-in-time rollback: **not implemented**, documented as a known limitation, not falsely claimed

## Backend Deployment

- [x] PASS — `npm start` (`node server.js`) is the actual, documented start command — confirmed against `package.json`, nothing invented
- [x] PASS — Correct `PORT` used (defaults to 5000, respects the environment variable when set)
- [x] PASS — Database connection succeeds on startup (confirmed via `/api/health` reporting `database: "connected"`)
- [x] PASS — Graceful shutdown on SIGTERM verified live: the `timeout` command's real SIGTERM signal was observed triggering "HTTP server closed" → "PostgreSQL pool closed" → "Graceful shutdown complete" → clean exit
- [x] PASS — SIGINT handling verified to be wired identically to SIGTERM (same handler function; both registered)
- [ ] NOT TESTED — ENVIRONMENT LIMITATION — behavior under real concurrent production load / behind a real load balancer or reverse proxy

## Frontend Deployment

- [x] PASS — `npm run build` succeeds with 0 errors
- [x] PASS — Built output scanned for `JWT_SECRET`, `DATABASE_URL`, known placeholder secret values, and `postgres://` connection strings — none found
- [x] PASS — Confirmed `VITE_API_BASE_URL` must be set before building (defaults to `http://localhost:5000/api` otherwise) — documented in the README's troubleshooting table
- [ ] NOT TESTED — ENVIRONMENT LIMITATION — actual deployment to a real static host/CDN and real cross-origin request from a real deployed frontend domain

## Post-Deployment Verification (Smoke Test)

- [ ] NOT TESTED — ENVIRONMENT LIMITATION — no real deployed URLs exist to test against
- [x] PASS (as a local substitute) — The complete Phase 13 automated suite (203 checks, covering every functional flow the smoke test would exercise: auth, events, registration/seats, QR, check-in, feedback, certificates, both dashboards) was re-run against the local server after all Phase 14 changes, with an identical 203/203 result

## Rollback Procedure

If a deployment needs to be rolled back:

1. Stop the new backend process (send `SIGTERM`; graceful shutdown verified above).
2. If the new deployment ran a migration incompatible with the previous backend version, run `npm run migrate:down` for each migration introduced since the last known-good release (verified working for a single step; repeat manually for more).
3. Restore the previous backend build/version and restart it.
4. If data was corrupted (not just schema), restore from the most recent `pg_dump` backup (see README §16.17) — **this requires that a backup was actually taken beforehand**, since none are automated.
5. Re-point the frontend's `VITE_API_BASE_URL` and rebuild if the backend's URL changed.

## Incident Troubleshooting

See README §16.18 for the full table. Summary: most startup failures are
now caught immediately and explained by the new environment validation
(Phase 14) rather than surfacing as a confusing runtime error later.

## Backup / Recovery

- [x] DOCUMENTED (`pg_dump`/`pg_restore` commands, README §16.16–17) — **RECOMMENDED / MANUAL, not automated**
- [ ] NOT IMPLEMENTED — no scheduled/automated backup job exists in this codebase; stated plainly, not implied otherwise

## Security Verification (re-run this phase)

- [x] PASS — CORS: valid origin gets credentialed access; preflight works; an unauthorized origin does not get its own value reflected back (verified byte-identical response headers for legitimate vs. attacker-claimed origins)
- [x] PASS — Cookies: `httpOnly`, `sameSite=strict`, path-scoped, `secure` tied to `NODE_ENV=production` (unchanged from Phase 12, re-confirmed)
- [x] PASS — Health endpoint leaks no credentials or internal details
- [x] PASS — `npm audit`: 0 vulnerabilities, both packages
- [x] PASS — Phase 12 rate limiting and Phase 13 security-regression checks all still pass (part of the 203/203 re-run)

## Observability Checklist

| Item | Status |
|---|---|
| Health endpoint (`/api/health`) | **IMPLEMENTED** — verified live |
| Application logs (console, structured enough to be useful) | **IMPLEMENTED** — verified no secrets/tokens appear in them (Phase 12 audit, re-confirmed) |
| Database health check | **IMPLEMENTED** — folded into the health endpoint |
| Error monitoring (e.g. Sentry-style aggregation) | **RECOMMENDED** — not implemented |
| Uptime monitoring (external pinger/alerting) | **RECOMMENDED** — not implemented |
| Resource monitoring (CPU/memory/connection-pool saturation) | **RECOMMENDED** — not implemented |
| Alerting (paging/notification on failure) | **RECOMMENDED** — not implemented |

## Final Sign-Off

- [x] Phase 1–13 regression: **PASS** (203/203, identical count, re-run after Phase 14 changes)
- [x] Frontend build: **PASS**
- [x] Backend startup (valid config): **PASS**
- [x] Backend fail-fast (invalid/incomplete config): **PASS**
- [x] Clean-database migration chain: **PASS**
- [x] Migration rollback (single-step): **PASS**
- [x] Graceful shutdown: **PASS**
- [x] CORS: **PASS**
- [x] Cookie security: **PASS**
- [x] Health endpoint safety: **PASS**
- [x] Dependency audit: **PASS** (0 vulnerabilities)
- [x] Secret scan (source + build output + final ZIP): **PASS**
- [ ] Actual cloud deployment: **NOT PERFORMED** — no credentials/environment available
- [ ] Production smoke test against real URLs: **NOT TESTED — ENVIRONMENT LIMITATION**

**Overall: DEPLOYMENT-READY, NOT CLOUD-DEPLOYED.**

---

## Render + Supabase setup (October 2026)

The original Render free PostgreSQL instance expired and was suspended by
Render (free databases expire after 30 days), which is why production
`/api/health` reported `database: "disconnected"` and logins returned 500.
Production now uses Supabase PostgreSQL.

**Backend web service (Render)**

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm install && npm run migrate:up` — never add `seed:admin` here. Seed the admin ONCE from a local checkout whose `backend/.env` `DATABASE_URL` is the Supabase URL (`npm run seed:admin`); `ADMIN_*` variables are then not needed on Render at all. |
| Start Command | `npm start` |
| Health Check Path | `/api/health` (returns 503 when the database is unreachable) |

**Environment variables (Render → Environment).** Never commit these.

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase **Session pooler** URI (Connect → Session pooler, port 5432) + `?sslmode=verify-full&sslrootcert=certs/supabase-prod-ca-2021.crt`. Render has no IPv6, so the direct `db.<ref>.supabase.co` host does not work; the 6543 transaction pooler breaks node-pg-migrate's session advisory lock. Percent-encode special characters in the password. |
| `DB_POOL_MAX` | `5` (Nano pooler pool size is 15 per user+db; leaves room for build-time migrate/seed while the old instance still runs) |
| `NODE_ENV` | `production` |
| `CLIENT_URL` | `https://corporate-event-management-1.onrender.com` (comma-separate extra origins) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | long random strings |
| `EMAIL_PROVIDER` | `brevo` (Render free blocks SMTP ports 25/465/587) |
| `EMAIL_API_KEY` | Brevo API key (`xkeysib-…`) |
| `EMAIL_FROM` | `Corporate Event Management <you@verified-sender>` — a sender verified in Brevo |

`DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` are ignored when
`DATABASE_URL` is set and can be removed.

**Row Level Security.** Migration `1700000000010` enables RLS (no policies)
on every table (`1700000000012` does the same for the Phase 15
`email_verification_codes` table), so Supabase's Data API (anon/authenticated keys) can read
nothing. The backend connects as the table owner and is unaffected.

**Verify after deploy**

```bash
curl -i https://corporate-event-management.onrender.com/api/health   # 200, database: connected
```

**Migration strategy.** Render's Pre-Deploy Command is paid-only, so
migrations run in the build. This is safe for this project because
node-pg-migrate (v9) by default: runs all pending migrations in ONE
transaction (any failure rolls everything back and fails the build, so
the previous deploy keeps serving), holds a Postgres advisory lock (two
concurrent builds cannot migrate at once), records applied migrations in
`pgmigrations` (re-runs are no-ops) and checks ordering. Caveat: a
successful build applies the schema change before the new code goes live,
so future migrations must stay backward-compatible with the running
version (add columns/tables first, remove them in a later release).

**TLS.** `backend/certs/supabase-prod-ca-2021.crt` is Supabase's public
root CA (downloaded from Database Settings → SSL configuration; SHA-256
80:70:25:AD:…:E6:CA:FA, valid to 2031-04-26). With `sslmode=verify-full`
both the app and the migration tool verify the pooler certificate and
hostname. Also enable **Enforce SSL on incoming connections** in Supabase.
