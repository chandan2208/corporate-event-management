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
