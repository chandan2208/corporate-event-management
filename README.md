# Corporate Event / Conference Management System

A production-style full-stack system for managing corporate events: event
creation, employee registration with automatic seat allocation, QR-code-based
check-in, feedback, certificate generation, and analytics dashboards for
Admin and Employee roles.

> **Phase 15 (Email Verification Code / OTP) added** — new employees must
> verify their email with a 6-digit emailed code before they can sign in.
> See [Email Verification (Phase 15)](#17-email-verification-phase-15).
> "Phase 15 email verification completed against the defined verification
> scope." (Not a claim of "100% secure".)
>
> **Status: Phase 14 complete (Deployment & Production Readiness).** Project
> setup, authentication, event management, employee event registration with
> concurrency-safe seat allocation, QR code generation, admin QR-scanning
> check-in, speaker/schedule management, certificate generation/verification,
> the employee dashboard, the admin analytics dashboard, a security-hardening
> pass, comprehensive automated testing/QA (203 checks), and production
> deployment readiness (environment validation, graceful shutdown, verified
> clean-database migration chain, verified CORS/cookie/health behavior) are
> all implemented and verified. **Note:** Phase 8 (Event Feedback) code
> exists and passed its own tests, but its formal review was previously
> deferred and is not being re-claimed as newly approved here. **The
> application has NOT been deployed to an actual cloud/production
> environment** — this sandbox has no cloud provider credentials or
> external deployment access. Phase 14 verified deployment-*readiness*
> against everything testable in this environment; see the Production
> Deployment section for the exact scope. This is not a claim of "100%
> production ready," "100% secure," or "bug free."

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + Tailwind CSS + React Router + Axios |
| Backend | Node.js + Express.js |
| Database | PostgreSQL |
| Auth (upcoming) | JWT + bcrypt |
| Version Control | Git / GitHub |

## Project Structure

```
corporate-event-management/
├── backend/
│   ├── src/
│   │   ├── config/        # DB connection, env-based config
│   │   ├── controllers/   # request/response handlers (thin)
│   │   ├── routes/        # Express route definitions
│   │   ├── middleware/    # error handling, auth (later), validation (later)
│   │   ├── models/        # DB queries / data access (added in DB phase)
│   │   ├── services/      # business logic
│   │   ├── utils/         # helpers (ApiError, etc.)
│   │   └── app.js         # Express app configuration
│   ├── server.js          # entry point (loads env, starts server)
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/           # Axios instance + API call modules
│   │   ├── components/    # shared/reusable UI components
│   │   ├── features/      # feature-based modules (auth, events, etc.)
│   │   ├── layouts/       # page layouts (Admin/Employee)
│   │   ├── pages/         # route-level pages
│   │   ├── routes/        # route guards/config (added later)
│   │   ├── context/       # React context providers (added later)
│   │   ├── hooks/         # custom hooks
│   │   └── utils/         # helpers
│   ├── .env.example
│   └── package.json
├── .gitignore
└── README.md
```

## Prerequisites

Install these before you start:

- **Node.js** v18 or higher (check with `node -v`)
- **npm** (comes with Node.js)
- **PostgreSQL** v13 or higher, installed and running locally (only needed
  from the next phase onward — the health-check endpoint works even without
  it, it will just report the database as "disconnected")
- **Git**

---

## 1. Backend Setup

**Directory:** `corporate-event-management/backend`

### Step 1 — Install dependencies

```bash
cd corporate-event-management/backend
npm install
```

This reads `package.json` and downloads all required packages (Express,
cors, dotenv, bcrypt, jsonwebtoken, pg, nodemon) into a local
`node_modules` folder.

### Step 2 — Create your environment file

```bash
cp .env.example .env
```

Then open `.env` and fill in your real PostgreSQL credentials, JWT secrets,
and initial admin details:

```
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=corporate_event_db
DB_USER=postgres
DB_PASSWORD=your_actual_postgres_password

# Used by the migration tool — keep in sync with the DB_* values above
DATABASE_URL=postgres://postgres:your_actual_postgres_password@localhost:5432/corporate_event_db

JWT_SECRET=replace_this_with_a_long_random_string
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=replace_this_with_another_long_random_string
JWT_REFRESH_EXPIRES_IN=7d

BCRYPT_SALT_ROUNDS=12

CLIENT_URL=http://localhost:5173

# Used ONLY by `npm run seed:admin` (see Phase 2 setup below)
ADMIN_NAME=System Administrator
ADMIN_EMAIL=admin@corporate-event.com
ADMIN_PASSWORD=choose_a_strong_password
```

**Generate strong secrets** for `JWT_SECRET` and `JWT_REFRESH_SECRET` instead
of using the placeholder text — for example:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run that twice and paste one result into each secret.

### Step 3 — Create the database

```bash
psql -U postgres -c "CREATE DATABASE corporate_event_db;"
```

### Step 4 — Run database migrations

```bash
npm run migrate:up
```

This creates the `users` table (and, in later phases, every other table)
using version-controlled migration files in `backend/migrations/`. Each
migration only ever runs once — node-pg-migrate tracks what's already been
applied in a `pgmigrations` table it manages automatically.

To undo the most recent migration (useful while developing):

```bash
npm run migrate:down
```

### Step 5 — Create the initial admin account

```bash
npm run seed:admin
```

This reads `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` from your
`.env` and creates exactly one admin account. **There is no public API for
creating admin accounts** — this script is the only way, by design, so an
attacker can never register themselves as an admin through the app.

Run this once. Running it again is safe — it detects the account already
exists and does nothing.

### Step 6 — Run the backend

```bash
npm run dev
```

- `npm run dev` uses **nodemon**, which automatically restarts the server
  whenever you edit a file — use this while developing.
- `npm start` runs it once with plain Node — use this in production.

You should see:

```
Backend server running on http://localhost:5000
Health check: http://localhost:5000/api/health
```

### Step 5 — Verify it works

Open a browser or run:

```bash
curl http://localhost:5000/api/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "server": "ok",
    "database": "connected",
    "timestamp": "2026-09-10T07:00:00.000Z",
    "uptimeSeconds": 5
  }
}
```

(By this phase, PostgreSQL is set up, so `"database"` should say
`"connected"`. If it still says `"disconnected"`, double check your `.env`
credentials and that PostgreSQL is running.)

---

## 2. Frontend Setup

**Directory:** `corporate-event-management/frontend`

### Step 1 — Install dependencies

```bash
cd corporate-event-management/frontend
npm install
```

### Step 2 — Create your environment file

```bash
cp .env.example .env
```

This sets:

```
VITE_API_BASE_URL=http://localhost:5000/api
```

which tells the frontend where the backend API lives. Any environment
variable used in Vite must be prefixed with `VITE_` or it won't be exposed
to the browser code.

### Step 3 — Run the frontend

```bash
npm run dev
```

You should see something like:

```
➜  Local:   http://localhost:5173/
```

Open that URL in your browser. You should see a **"Project setup
verification page"** card:
- A green dot + "Backend reachable" if the backend (Step 1 above) is
  running.
- A red dot + "Backend not reachable" if it isn't — start the backend and
  refresh.

This confirms React, Vite, Tailwind CSS, React Router, and Axios are all
correctly wired together and talking to the backend.

---

## 3. Authentication — How It Works & How to Test It

### Endpoints

| Method | Path | Auth required | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | No | Always creates an **employee** — `role` is never read from the request. **Phase 15:** account starts unverified, a code is emailed, **no token is issued** |
| POST | `/api/auth/verify-email` | No | **Phase 15** — `{ email, code }` marks the email verified |
| POST | `/api/auth/resend-verification` | No | **Phase 15** — `{ email }` emails a new code (generic response, 60 s cooldown) |
| POST | `/api/auth/login` | No | Works for both admin and employee; role comes from the DB. **Phase 15:** unverified accounts get `403 EMAIL_NOT_VERIFIED` |
| GET | `/api/auth/me` | Yes (access token) | Returns the current user |
| POST | `/api/auth/refresh-token` | No (uses httpOnly cookie) | Issues a new access token |
| POST | `/api/auth/logout` | No | Clears the refresh-token cookie |

### Token strategy

- **Access token**: short-lived (15 min default), returned in the JSON
  response body, kept only in memory on the frontend (never
  localStorage), sent as `Authorization: Bearer <token>`.
- **Refresh token**: long-lived (7 days default), stored in an **httpOnly**
  cookie the browser manages automatically — JavaScript can never read it,
  which limits the damage a successful XSS attack could do.
- When an access token expires, the frontend automatically calls
  `/refresh-token` once and retries the failed request — the user never
  notices, and never needs to log in again until the refresh token itself
  expires or they log out.

### Manual test with curl

```bash
# Register an employee (Phase 15: emails a 6-digit code; no token returned)
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"Passw0rd1"}'

# Verify with the code from the email, then log in normally
curl -X POST http://localhost:5000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","code":"123456"}'

# Log in as the admin you created in Step 5 above
curl -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@corporate-event.com","password":"<the password from your .env>"}'

# Call a protected route (replace <token> with the accessToken from the response above)
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/auth/me
```

### Manual test in the browser

1. Start both backend and frontend (see below).
2. Visit `http://localhost:5173/register`, create an employee account →
   you land on **Verify your email**. Enter the 6-digit code from the
   email (Phase 15), then sign in → you land on the **Employee Dashboard**.
3. Click **Log out**.
4. Visit `/login` and sign in with the admin credentials from your `.env`
   → you should land on the **Admin Dashboard**.
5. Refresh the page — you should stay logged in (this proves the
   refresh-token cookie flow works).
6. While logged in as the employee, manually navigate to
   `/admin/dashboard` in the address bar — you should be redirected back
   to `/employee/dashboard` instead of seeing the admin page.

---

## 4. Event Management (Phase 3)

### Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/events` | Any logged-in user | Admin sees all statuses (filterable); employee always sees only `PUBLISHED` |
| GET | `/api/events/:id` | Any logged-in user | Employees get 404 for `DRAFT` events |
| POST | `/api/events` | Admin only | Creates a `DRAFT` event |
| PUT | `/api/events/:id` | Admin only | Blocked once event is `CANCELLED` or `COMPLETED` |
| PATCH | `/api/events/:id/status` | Admin only | Status transitions (see state machine below) |
| DELETE | `/api/events/:id` | Admin only | Only allowed while status is `DRAFT` |

Query params on `GET /api/events`: `page`, `limit` (max 100), `search`
(matches title or venue), `status` (admin only — ignored for employees),
`sortBy` (`event_date`, `created_at`, `title`, `capacity`), `order` (`asc`/`desc`).

### Status state machine

```
DRAFT ──publish──► PUBLISHED ──complete──► COMPLETED (final)
  │                    │
  └──cancel──► CANCELLED ◄──cancel─────────┘
     (final)
```

Once an event is `PUBLISHED`, it can never go back to `DRAFT` — only
forward to `CANCELLED` or `COMPLETED`. This is enforced by both the
backend's state machine and validated against the merged final state of
the event on every edit (see "Production Hardening" below).

Deleting (hard delete) is only allowed from `DRAFT` — once an event is
published, admins cancel it instead so the historical record is preserved.

### Manual test in the browser

1. Log in as admin → **Events** → **+ Create Event** → fill the form → you
   land on the event's detail page with status `DRAFT`.
2. Click **Publish Event** → status badge turns green (`PUBLISHED`).
3. Log out, log in as an employee → **Events** → the event now appears in
   the browsable list → click it to see full details.
4. Back as admin, click **Edit**, change the capacity, save → confirm the
   change shows on the detail page.
5. Click **Cancel Event** → confirm in the dialog → status turns red
   (`CANCELLED`). Notice the **Edit** and **Delete** buttons disappear.
6. Create a second event and leave it as `DRAFT`, then click **Delete** →
   confirm — it's gone from the list entirely.

### Production hardening (post-review fixes)

Two issues were found on review and fixed:

1. **Partial-update validation now checks the merged final state.** Editing
   only `eventDate` (or only `startTime`/`endTime`) used to be validated in
   isolation, which could silently leave the event in an inconsistent
   state — e.g. moving the event earlier without re-checking that
   `registrationDeadline` (left untouched) still falls before the new
   event start. The service layer now loads the existing event, merges the
   patch on top of it, and validates the **entire resulting event** with
   the same rules used at creation (including "event date can't be in the
   past") before saving anything.
2. **`PUBLISHED → DRAFT` is no longer allowed.** Once an event is
   published, it can only move forward to `CANCELLED` or `COMPLETED` —
   never silently back to an invisible draft.

---

## 5. Employee Registration & Seat Allocation (Phase 4)

### Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/events/:eventId/register` | Employee only | Concurrency-safe; auto-assigns the first available seat |
| GET | `/api/events/:eventId/registration` | Employee only | The requesting employee's own registration for that event |
| GET | `/api/my-registrations` | Employee only | Paginated, filterable by status |
| DELETE | `/api/registrations/:id` | Employee only | Cancels (soft-delete) — ownership-enforced |

### Concurrency safety — how it actually works

Every registration attempt runs inside **one PostgreSQL transaction**:

```
BEGIN;
SELECT * FROM events WHERE id = $1 FOR UPDATE;   -- locks the event row
-- (all checks + seat selection happen here, still holding the lock)
INSERT INTO registrations (...) VALUES (...);
COMMIT;                                          -- releases the lock
```

The `FOR UPDATE` lock means that if two employees hit "Register" on the
same event at the exact same millisecond, the second request's transaction
simply **waits** at that line until the first one commits or rolls back.
By the time the second request gets the lock, it re-reads the real,
up-to-date seat count and seat list — so it's mathematically impossible
for two requests to both believe "there's 1 seat left" and both succeed.

Two **partial unique database indexes** back this up independently:
`(event_id, user_id)` and `(event_id, seat_label)`, both scoped to
non-cancelled rows. Even if the application logic above ever had a bug,
the database itself would still refuse a duplicate seat or duplicate
active registration.

This was verified with a real concurrency test (not simulated) — see the
verification report for exact results: 10 simultaneous requests against a
1-seat event produced exactly 1 success; against a 3-seat and 5-seat event
produced exactly 3 and 5 successes respectively, each with unique,
gap-free seat numbers.

### Seat labeling

Seats are assigned `A-01, A-02, ... A-50, B-01, ...` (50 per row), with a
spreadsheet-style overflow (`AA-01, AB-01, ...`) if an event's capacity
ever exceeds 26 rows. Cancelling a seat frees it for the **next**
registrant — the system fills gaps rather than always growing forward.

### Manual test in the browser

1. Log in as an employee, browse to a published event, click **Register
   for this Event** → see your assigned seat immediately.
2. Go to **My Registrations** in the nav → see it listed with status
   `REGISTERED`.
3. Click **Cancel** → confirm → status disappears from the active list
   (or shows as `CANCELLED` if you filter by that status).
4. Register again for the same event → notice you may get the same seat
   back if no one else took it in the meantime.

---

## 6. QR Code Generation (Phase 5)

### Endpoint

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/registrations/:id/qr` | Employee only | Ownership-enforced; refuses cancelled registrations |

### Library

[`qrcode`](https://www.npmjs.com/package/qrcode) — actively maintained,
zero runtime dependencies, ~40M weekly downloads, the standard choice for
server-side QR generation in Node. Used with fixed encoding options
(error-correction level, margin, width) so the same input always produces
byte-identical output.

### Payload design

The QR encodes **only** the registration's existing random token — the
exact same 64-character hex string generated at registration time in
Phase 4 (`utils/qrToken.js`). Nothing else: no name, email, phone number,
or other personal data. The token itself carries no identifying
information — it's pure random bytes — so even if a QR image were
intercepted, it reveals nothing about the person without the backend's
own lookup (which is ownership-enforced, see below).

The image is generated **on demand** from the stored token and never
persisted — there is no QR-image column anywhere in the database. This
means:
- Generating a registration's QR twice produces byte-identical images
  (verified in testing).
- Viewing/downloading a QR never touches or mutates the registration row
  (`created_at` and `updated_at` remain identical after repeated QR
  requests — verified in testing).

### Security / ownership rules

- Every request requires a valid access token (`authenticate` middleware).
- Ownership is checked using `req.user.id` — the identity the JWT
  actually proves — never anything from the URL or request body. The
  registration `id` in the URL is only a lookup key.
- A different employee's registration `id` (an ID-manipulation/IDOR
  attempt) is rejected with 403.
- A cancelled registration returns 409 — it never produces what looks
  like a valid, presentable check-in code.
- Malformed (non-UUID) registration IDs are treated as "not found" (404)
  rather than leaking a raw database error — a real bug caught and fixed
  during this phase's testing (see the verification report).

### Manual test in the browser

1. Register for a published event as an employee.
2. On the event detail page, the QR code now renders automatically below
   your seat confirmation, with a **Download QR Code** link.
3. Go to **My Registrations** → click **View QR** on any active
   registration → same QR appears in a modal.
4. Cancel a registration → its **View QR** option disappears from the list
   (only non-cancelled registrations show it).

### Production hardening (post-review fixes)

- The `GET /api/registrations/:id/qr` response no longer echoes the raw
  token in JSON — only `registrationId` and `dataUrl`. The QR image itself
  is unchanged (it still encodes the token, which is what Phase 6's
  scanner needs); this only removes an unnecessary plaintext copy of a
  bearer-style credential from an API response that didn't need it.
- Added a permanent, committed regression test:
  `backend/scripts/qrDecodeTest.js`, run via `npm run test:qr`. It
  generates a QR from a fixed known token, decodes the image back to
  text, and asserts an exact match — plus checks determinism and that
  different tokens decode differently.

---

## 7. QR Scanning + Instant Attendance (Phase 6)

### Endpoint

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/registrations/check-in` | **Admin only** | Body: `{ "token": "<64-char hex>" }` |

Success response (200):
```json
{
  "success": true,
  "data": {
    "registration": {
      "id": "...",
      "status": "CHECKED_IN",
      "seatLabel": "A-01",
      "checkedInAt": "2026-...",
      "employeeName": "Priya Sharma",
      "event": { "id": "...", "title": "...", "venue": "..." }
    }
  }
}
```
The raw token is never included in this response, in error responses, or
in any server log line.

### Scanner library

**[`html5-qrcode`](https://www.npmjs.com/package/html5-qrcode)** —
actively maintained, ~1M+ weekly downloads, works via `getUserMedia` camera
access wrapped in a simple start/stop/pause/resume API. **It does not use
the native `BarcodeDetector` API by default** — that's an opt-in
"experimental feature" flag in the library (confirmed by inspecting its
source) which we deliberately do not enable — instead it decodes every
camera frame using its own bundled JS decoder, which gives consistent
behavior across all browsers (including Safari, where `BarcodeDetector`
still isn't natively supported as of this writing) rather than depending
on which browsers happen to support the native API.

### Check-in state rules

```
REGISTERED → CHECKED_IN   allowed
CANCELLED  → CHECKED_IN   blocked (409)
CHECKED_IN → CHECKED_IN   blocked (409, "already checked in")
COMPLETED  → CHECKED_IN   blocked (409)
```

Event-level rule: check-in is only allowed while the event's status is
`PUBLISHED`. A `DRAFT`, `CANCELLED`, or `COMPLETED` event blocks check-in
even if the individual registration is still `REGISTERED`.

### Concurrency strategy

Identical pattern to Phase 4's seat allocation: `SELECT ... FOR UPDATE OF r`
locks the registration row (not the joined event row) for the duration of
one transaction. A second simultaneous scan of the same token blocks at
that line until the first commits, then re-reads the now-`CHECKED_IN`
status and correctly returns 409. Verified with a real parallel-request
test — see the verification report for exact results.

### Manual test in the browser

1. Log in as admin → **Check-in** in the nav → **Start Scanner** (grants
   camera permission).
2. Point the camera at an employee's QR code (from their event detail
   page or My Registrations) → check-in result appears automatically.
3. Click **Scan Next** to resume scanning.
4. Scan the same QR again → "This registration has already been checked
   in" (409), not a false success.

---

## 8. Speakers + Event Schedule (Phase 7)

### API endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/events/:eventId/speakers` | Any logged-in user | Draft events hidden from employees (404) |
| POST | `/api/events/:eventId/speakers` | Admin only | Blocked once event is cancelled/completed |
| PUT | `/api/speakers/:id` | Admin only | Same terminal-state block |
| DELETE | `/api/speakers/:id` | Admin only | Same terminal-state block |
| GET | `/api/events/:eventId/schedule` | Any logged-in user | Same visibility rule as speakers |
| POST | `/api/events/:eventId/schedule` | Admin only | Speaker must belong to the same event; time must fall within the event's hours |
| PUT | `/api/schedule/:id` | Admin only | Partial updates validated against the full merged session |
| DELETE | `/api/schedule/:id` | Admin only | Same terminal-state block |

### Architecture

Two new tables: `speakers` (FK to `events`, `ON DELETE CASCADE` — a
speaker can never outlive the event it belongs to) and `event_sessions`
(FK to `events` CASCADE, FK to `speakers` **SET NULL** — deleting a
speaker removes them from a session's display without deleting the
session itself, since a session's own content, e.g. "Lunch" or "Panel
Discussion", is still meaningful without a named speaker).

Session `start_time`/`end_time` are `TIME` columns (matching the
convention already used on `events`) since every session happens on the
event's single existing date — a session doesn't need its own separate
date field. A `CHECK (end_time > start_time)` constraint backs this at
the database level; the service layer additionally checks that a
session's time falls within the event's own start/end hours (a
cross-table rule that can't live in a database CHECK constraint without a
trigger, so it's enforced in `schedule.service.js` instead).

Speaker/schedule visibility for employees reuses the exact same
"drafts are invisible" rule as event management (Phase 3) — implemented
as a small shared utility (`utils/eventAccess.js`) that both new services
import, rather than duplicating the logic or modifying
`event.service.js` itself.

**Terminal-state rule:** once an event is `CANCELLED` or `COMPLETED`,
its speakers and schedule are frozen — no create/update/delete — mirroring
the same rule already applied to editing the event itself.

### Manual test in the browser

1. Log in as admin → open an event's detail page → **Speakers** section →
   **+ Add Speaker** → fill the form.
2. **Schedule** section → **+ Add Session** → pick the speaker you just
   added, set a time within the event's hours.
3. Publish the event, then log in as an employee → open the same event →
   both sections now show read-only (no add/edit/delete controls).
4. Back as admin, delete the speaker → the session survives with no
   speaker shown.
5. Cancel the event → both sections' admin controls disappear (backend
   would reject the mutation with 409 even if called directly).

---

## 9. Event Feedback (Phase 8)

### API endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/events/:eventId/feedback` | Employee only | Requires CHECKED_IN or COMPLETED registration |
| GET | `/api/events/:eventId/feedback/me` | Employee only | Own feedback; 404 if not submitted |
| GET | `/api/admin/events/:eventId/feedback` | Admin only | Full list with employee names |
| GET | `/api/admin/events/:eventId/feedback/summary` | Admin only | Average, total, rating distribution |

### Eligibility rule

| Registration state | Result |
|---|---|
| No registration | 409 |
| `REGISTERED` (not checked in) | 409 |
| `CANCELLED` | 409 |
| `CHECKED_IN` | ✅ allowed |
| `COMPLETED` | ✅ allowed |

### Event-state rule

`DRAFT` and `CANCELLED` events never accept feedback. `PUBLISHED` and
`COMPLETED` do — **this is deliberate**: the normal flow is attend →
get checked in → event ends → admin marks it `COMPLETED` → *then*
employees leave feedback. Blocking feedback on `COMPLETED` events would
break the most common real-world case.

### Duplicate/concurrency strategy

Unlike seat allocation or check-in, feedback submission doesn't need row
locking: it's a pure "has this (event, user) pair ever submitted before"
check, which a **database UNIQUE(event_id, user_id) constraint**
already guarantees atomically. The service pre-checks eligibility, then
attempts the INSERT; if two requests race past the pre-check at the same
instant, only one INSERT can win — the other fails with Postgres's
unique-violation code (23505), caught and converted to a clean 409.
Verified with a real parallel-request test (see the verification report).

### Admin summary

Calculated live from the database on every request (no stored aggregate
column) — one query for count/average, one grouped query for the
1-through-5 distribution, normalized so all 5 buckets are always present
even at zero.

### Manual test in the browser

1. As an employee, open a **published** event's detail page after being
   checked in (via the admin scanner) → a **Feedback** section appears
   with a star selector.
2. Submit a rating → see the submitted state; the form disappears.
3. As admin, open the same event → **Feedback** section shows the
   average, distribution bars, and the individual response.
4. As a different (not-yet-checked-in) employee, open the same event →
   see "Feedback becomes available after you've been checked in."

---

## 10. Certificate Generation & Verification (Phase 9)

### API endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/certificates/verify/:verificationToken` | **Public — no auth** | Safe fields only, never the raw token |
| GET | `/api/my-certificates` | Employee only | Own certificates |
| GET | `/api/registrations/:registrationId/certificate` | Employee only | Idempotent get-or-create; ownership-enforced |
| GET | `/api/certificates/:certificateId/download` | Owner or admin | Streams a real PDF, generated on demand |
| GET | `/api/admin/certificates` | Admin only | Paginated, filterable by status |
| GET | `/api/admin/certificates/:certificateId` | Admin only | Detail view |
| POST | `/api/admin/registrations/:registrationId/certificate` | Admin only | Idempotent get-or-create, no ownership check |
| POST | `/api/admin/certificates/:certificateId/revoke` | Admin only | One-way, idempotent-safe |

### Eligibility

Same two statuses as feedback: `CHECKED_IN` or `COMPLETED`. `REGISTERED` and `CANCELLED` are blocked (409).

### Idempotency & concurrency

Unlike feedback (where a duplicate is a user error worth flagging with
409), a repeated certificate request is a normal, expected case — "give
me my certificate" should always succeed if you're eligible. The
get-or-create flow: check for an existing certificate first; if none,
insert one; if a concurrent request won the race (unique-violation on
`registration_id`), simply return **their** row instead of erroring.
Verified live: **15 simultaneous requests for the same registration → all
15 succeeded, all converged to the exact same certificate ID/number**,
confirmed in the database.

### PDF generation

Real PDFs via **PDFKit**, generated **entirely in memory** at download
time — nothing is ever written to disk, so there's no certificates
directory to manage and no file-path attack surface at all. Verified by
actually rendering a generated certificate to a PNG and visually
inspecting it, and by decoding the embedded QR code from the rendered PDF
to confirm it contains the correct verification URL.

### Security

- Ownership enforced server-side; a real IDOR bug was found and fixed
  during testing (see verification report) where the employee-facing
  get-or-create endpoint didn't check that the requested registration
  belonged to the caller.
- The verification token is never returned in any authenticated or admin
  API response — only a full `verificationUrl` (safe to share) is
  exposed; the public verify endpoint doesn't echo the token either.
- A revoked certificate can never download as valid again for its
  employee (409); admins retain download access for audit purposes.
- A routing-order bug was also found and fixed: several existing routers
  apply a blanket `authenticate` middleware and are mounted at `/`, which
  was silently intercepting the new public verify route before it could
  ever be reached. Fixed by reordering router mounts in
  `routes/index.js` — no Phase 1–8 route file's own contents changed.

### Manual test in the browser

1. As admin, check an employee in to a published event.
2. As that employee, open the event detail page → a **Certificate**
   section shows "Certificate Available" with a download link.
3. Click **Download PDF** → a real certificate PDF downloads.
4. Scan the QR code on the certificate (or visit
   `/verify/certificate/<token>` directly) → see the public verification
   page confirm it's valid.
5. As admin, go to **Certificates** → find it → **Revoke** → the public
   verification page now shows "Revoked Certificate."

---

## 11. Employee Dashboard (Phase 10)

### Purpose

`/employee/dashboard` is the employee's central workspace after login —
a single aggregated view of their upcoming events, registrations,
certificates, and recent activity, without needing to visit five
different pages.

### Endpoint

`GET /api/employee/dashboard` — employee-only. Returns only data
belonging to the authenticated employee; identity comes exclusively from
the verified JWT (`req.user.id`). A `?userId=` query parameter is simply
ignored — there is no code path that reads it.

### Response structure

```json
{
  "summary": {
    "upcomingEvents": 0,
    "registeredEvents": 0,
    "attendedEvents": 0,
    "certificatesAvailable": 0,
    "feedbackPending": 0
  },
  "upcomingEvents": [ /* next 5, with schedule/speaker info attached */ ],
  "registrations": [ /* up to 100 most relevant */ ],
  "certificates": [ /* from the existing Phase 9 service, unmodified */ ],
  "recentActivity": [ /* up to 10, sorted by real timestamps */ ]
}
```

### Data sources (no duplicated business logic, no fabricated numbers)

| Field | Source |
|---|---|
| `registrations`, seat, status, check-in time | `registrationModel.listForUser` — **reused directly from Phase 4/6**, unmodified |
| `certificates` | `certificateService.listMyCertificates` — **reused directly from Phase 9**, unmodified |
| Feedback-submitted status | one new, additive, **batched** query (`dashboard.model.js`) — a single `SELECT event_id, created_at FROM feedback WHERE user_id = $1`, not a per-registration lookup |
| Schedule/speaker info on upcoming events | one new, additive, **batched** query using `WHERE event_id = ANY($1::uuid[])` — one round trip for all upcoming events at once, not one query per event |
| `summary.*` counts | computed in JS from the same rows already fetched above — no extra queries, and verified in testing to exactly match direct `COUNT(*)` SQL against the same tables |
| `recentActivity` | assembled from real timestamps already present on the fetched rows (`registered_at`, `checked_in_at`, `cancelled_at`, feedback `created_at`, certificate `issued_at`) — nothing fabricated |

`certificatesAvailable` counts **eligible** registrations (CHECKED_IN/
COMPLETED), not merely already-generated certificate rows — since Phase
9's certificates are created lazily on first request, an employee who
attended an event but hasn't clicked "download" yet still correctly sees
their certificate as available.

### What the dashboard does NOT reimplement

QR display, certificate download, and feedback submission all reuse the
exact existing Phase 5/9/8 components/endpoints (`QrModal`,
`CertificateAvailability`'s pattern, and a plain link to the event detail
page's existing feedback form) — no second QR generator, no second
certificate generator, no second feedback system.

### Manual test in the browser

1. Log in as an employee with some event history → `/employee/dashboard`
   shows real summary numbers, upcoming events with schedule snippets,
   recent registrations, certificates, and a recent-activity feed.
2. Click **View QR** on an upcoming event → the same QR modal from My
   Registrations opens.
3. Click **Give Feedback** on an eligible event → navigates to that
   event's detail page where the existing feedback form lives.
4. A brand-new employee with no history sees empty states (zero counts,
   "no upcoming events," "browse events" call to action) — never fake
   placeholder numbers.

### Known limitations

- Same no-headless-browser caveat as all prior phases — build-tested and
  API-verified, not literally clicked through.
- The dashboard's registration/certificate lists are capped (100 and
  whatever `listMyCertificates` returns) rather than paginated — adequate
  for a summary view; the dedicated My Registrations / My Certificates
  pages remain the full paginated source of truth.

---

## 12. Admin Dashboard + Analytics (Phase 11)

### Endpoint

`GET /api/admin/dashboard` — admin-only. Optional query filters:
`days` (1–365, default 30, validated) and `status` (one of the real
event_status enum values, validated). No `userId` parameter exists —
admin dashboards are system-wide by design and don't scope to a
particular user.

### A note on Express 5 and query validation (found during testing)

This project runs **Express 5**, where `req.query` is a read-only getter
that recomputes straight from the URL on every access — it has no
mutable backing store. The existing Phase 2 `validate` middleware (which
targets `req.body`) is unaffected, since `express.json()` sets `req.body`
as a plain writable property. But a first attempt at a query-validation
middleware for this phase (`req.query = result.data`) silently failed to
persist — confirmed by testing directly against Express — so validated/
defaulted query values are instead attached to a new property,
`req.validatedQuery`, which the controller reads from. This is isolated
entirely to the two new Phase 11 files that needed query validation; no
existing route or middleware was touched.

### Summary metrics & definitions

| Metric | Definition |
|---|---|
| `totalEvents` / `publishedEvents` / `upcomingEvents` | Direct counts from `events`; "upcoming" = `PUBLISHED` and `event_date >= CURRENT_DATE` |
| `totalRegistrations` | Non-cancelled registrations, system-wide |
| `totalAttendees` | Registrations with status `CHECKED_IN` or `COMPLETED` |
| `certificatesIssued` | All certificate rows ever created |
| **`attendanceRate`** | `totalAttendees / totalRegistrations * 100`, **one consistent definition used everywhere** a rate appears in this response (event performance, capacity, summary) — division-by-zero safe (returns 0, never NaN or a misleading 100%) |

### Registration & attendance trends

Real `created_at` (registrations) and `checked_in_at` (check-ins) grouped
by day in PostgreSQL, zero-filled in the service layer so a chart never
silently skips a day with no activity. A registration has at most one
`checked_in_at` timestamp (Phase 6's atomic design), so attendance can
never be double-counted.

### Event performance, popular events, and capacity utilization

All three are derived from **one** underlying query
(`getEventPerformanceData` — capacity, active registrations, attendance,
feedback count, certificate count per event, using scalar subqueries
rather than multiple LEFT JOINs to avoid a cartesian-product fan-out),
then sorted/filtered three different ways in the service layer. This
avoids running the same expensive aggregation three separate times.
Popularity = active (non-cancelled) registration count.

### Feedback & certificate analytics

Reuse the exact same aggregation pattern already proven in Phase 8/9 —
average rating, 1–5 distribution (always all 5 buckets present, zero-
filled), top-rated events; certificates issued/valid/revoked and
per-event breakdown. No new feedback or certificate tables — same
existing tables, system-wide queries instead of per-employee ones.

### Filters

`days` and `status` are both validated server-side (Zod), rejecting
non-numeric/out-of-range/SQL-injection-style input with a clean 400 —
verified live that a `days` value containing a SQL injection attempt is
rejected before ever reaching a query, and the `events` table was
confirmed intact afterward.

### Manual test in the browser

1. Log in as admin → `/admin/dashboard` → summary cards, registration/
   attendance trend charts, event status pie chart, feedback bar chart,
   event performance table, popular events, certificate overview, and
   recent events all populate with real data.
2. Switch the date range selector (7/30/90 days) → trend charts update.
3. On a fresh database with no events, every section shows a proper
   empty state — never a fake populated chart.

### Known limitations

- Same no-headless-browser caveat as all prior phases.
- Frontend bundle grew further with `recharts` (charting library) —
  confirmed the app still builds and all routes resolve, but this is a
  candidate for code-splitting in a future optimization pass.
- Recent admin activity (event created/published/cancelled) was
  **deliberately limited**: only "event created" (`events.created_at`)
  and certificate issued/revoked are shown, since there is no dedicated
  timestamp tracking *when* a status transition happened — `updated_at`
  is a generic modification timestamp that could reflect any edit, not
  specifically a status change, and showing it as "published on X" would
  risk being misleading. A full audit log is explicitly out of scope for
  this phase per the instructions.

---

## 13. Security Hardening (Phase 12)

This phase audited the entire application built in Phases 1–11 and
hardened specific gaps found. **This is a hardening pass against a
defined verification scope, not a claim of absolute or "100% secure"
status.**

### Security architecture summary

| Layer | Approach |
|---|---|
| Authentication | JWT access tokens (15m, in-memory on frontend) + refresh tokens (7d, httpOnly cookie, rotated on every use) |
| Password storage | bcrypt, cost factor 12 |
| Authorization | Role-based (`admin`/`employee`), enforced server-side on every route via `authorize()` — never inferred from the frontend |
| Ownership | Every "my own data" endpoint derives identity from the verified JWT (`req.user.id`), never from a client-supplied id |
| Input validation | Zod schemas on every mutating endpoint + a UUID-format middleware on every `:id`/`:eventId` param |
| SQL safety | 100% parameterized queries; the one dynamic `ORDER BY` (event listing) uses a hardcoded column allowlist |
| Rate limiting | Per-endpoint, env-configurable (see below) |
| Cookies | `httpOnly`, `secure` in production, `sameSite: strict`, scoped `path: /api/auth`, explicit `maxAge` |
| CORS | Single fixed allowed origin from `CLIENT_URL`, never a wildcard, never reflects an arbitrary request `Origin` back |
| Headers | `helmet()` defaults (X-Content-Type-Options, X-Frame-Options, HSTS when applicable, etc.) |
| Error handling | Generic messages + no stack trace when `NODE_ENV=production`; verified live in both modes |

### Token strategy (unchanged from Phase 2, re-verified)

Access tokens are never stored in `localStorage`/`sessionStorage` —
confirmed by grep, zero matches in the frontend source. Refresh tokens
rotate on every `/api/auth/refresh-token` call (a fresh token is issued
each time). **Known limitation:** there is no persisted reuse-detection
(no token blacklist/family tracking) — if an old, already-rotated-out
refresh token were stolen and replayed before its natural expiry, it
would still pass signature/expiry verification, since detecting "this
specific token was already superseded" requires a persisted state layer
(e.g. a `jti` blacklist table) that does not currently exist. Adding one
is a genuine architecture change, not a hardening tweak — documented here
rather than silently addressed, per the instruction not to introduce
large new infrastructure in this phase.

### Rate limiting (extended this phase)

| Endpoint | Default limit | Env var |
|---|---|---|
| `POST /api/auth/login`, `/register` | 20 / 15 min / IP | `RATE_LIMIT_AUTH` |
| `POST /api/auth/refresh-token` | 60 / 15 min / IP | `RATE_LIMIT_REFRESH` (**new**) |
| `POST /api/registrations/check-in` | 300 / 15 min / IP | `RATE_LIMIT_CHECKIN` (**new**) |
| `POST /api/events/:id/feedback` | 30 / 15 min / IP | `RATE_LIMIT_FEEDBACK` (**new**) |
| Certificate generate/download/verify | 30 / 15 min / IP | `RATE_LIMIT_CERTIFICATE` (**new**) |

**Known limitation, stated plainly:** `express-rate-limit`'s default
store is **in-memory, per Node process** — verified live (see testing
below) that it does trigger correctly, but this is **not distributed-safe**.
If this app were ever scaled to multiple instances behind a load
balancer, each instance would enforce its own independent counter, so
the effective system-wide limit becomes `(configured limit × instance
count)`. A proper fix requires a shared store (e.g. Redis via
`rate-limit-redis`) — a real new infrastructure dependency intentionally
NOT introduced in this phase, per the instruction to avoid large
infrastructure additions during hardening. This is documented, not
silently accepted as production-scale-safe.

### CSRF reasoning (no additional CSRF tokens added — reasoning documented)

The refresh-token cookie is `sameSite: strict` and scoped to `path:
/api/auth` — modern browsers will not attach it to cross-site requests at
all under this policy, which is the primary CSRF defense here. Every
actual protected business-logic API call uses the `Authorization: Bearer`
header (not a cookie), which a cross-site attacker page cannot forge
(no ambient credential to piggy-back on). The only cookie-authenticated
action is silently minting a new access token — even if somehow
triggered cross-site, the JSON response is blocked from being read by the
attacker's page by CORS (fixed-origin policy, not reflected). Given this,
adding CSRF tokens on top would be meaningful extra complexity for
negligible additional protection — the existing `sameSite` + fixed-CORS +
bearer-header architecture already addresses the realistic risk, so no
CSRF-token layer was added.

### Body size limits (new this phase)

`express.json()`/`express.urlencoded()` now use an explicit `200kb`
limit (previously relying on the framework's implicit default). Verified
live: a ~300KB payload is correctly rejected with `413 Payload Too
Large`, and the client-facing message stays generic in both dev and
production modes.

### Dependency audit

`npm audit` run on both `backend` and `frontend`: **0 vulnerabilities**
found in either, at any severity. No dependency changes were needed.

### QR / certificate security (re-verified, unchanged from Phases 5/6/9)

QR tokens are 64 cryptographically random hex characters, generated via
`crypto.randomBytes`; never contain employee PII; never logged (confirmed
by grep across every `console.*` call in the backend). Public certificate
verification returns only `status`, `certificateNumber`, `employeeName`,
`eventTitle`, `eventDate`, `issuedAt` — never the raw verification token.
PDFs are generated **entirely in memory** at request time — no file is
ever written to disk, so there is no certificates-directory attack
surface at all.

### Route security matrix

| Method | Path | Auth | Role | Ownership check | Rate limited |
|---|---|---|---|---|---|
| GET | `/api/health` | No | — | — | No |
| POST | `/api/auth/register` | No | — | — | Yes |
| POST | `/api/auth/login` | No | — | — | Yes |
| POST | `/api/auth/refresh-token` | Cookie | — | — | Yes (new) |
| POST | `/api/auth/logout` | No | — | — | No |
| GET | `/api/auth/me` | Yes | any | self (JWT) | No |
| GET | `/api/events` | Yes | any | role-scoped visibility | No |
| GET | `/api/events/:id` | Yes | any | draft hidden from employee | No |
| POST | `/api/events` | Yes | admin | — | No |
| PUT | `/api/events/:id` | Yes | admin | — | No |
| PATCH | `/api/events/:id/status` | Yes | admin | — | No |
| DELETE | `/api/events/:id` | Yes | admin | — | No |
| POST | `/api/events/:eventId/register` | Yes | employee | — | No |
| GET | `/api/events/:eventId/registration` | Yes | employee | self | No |
| GET | `/api/my-registrations` | Yes | employee | self | No |
| DELETE | `/api/registrations/:id` | Yes | employee | self | No |
| GET | `/api/registrations/:id/qr` | Yes | employee | self | No |
| POST | `/api/registrations/check-in` | Yes | admin | — | Yes (new) |
| GET/POST/PUT/DELETE | `/api/events/:eventId/speakers`, `/api/speakers/:id` | Yes | any read / admin write | draft hidden from employee | No |
| GET/POST/PUT/DELETE | `/api/events/:eventId/schedule`, `/api/schedule/:id` | Yes | any read / admin write | draft hidden from employee | No |
| POST | `/api/events/:eventId/feedback` | Yes | employee | self, eligibility-checked | Yes (new) |
| GET | `/api/events/:eventId/feedback/me` | Yes | employee | self | No |
| GET | `/api/admin/events/:eventId/feedback`, `/summary` | Yes | admin | — | No |
| GET | `/api/certificates/verify/:token` | **No** | — | — | Yes (new) |
| GET | `/api/my-certificates` | Yes | employee | self | No |
| GET | `/api/registrations/:registrationId/certificate` | Yes | employee | self | Yes (new) |
| GET | `/api/certificates/:certificateId/download` | Yes | any (self OR admin) | self or admin, revocation-aware | Yes (new) |
| GET | `/api/admin/certificates`, `/:id` | Yes | admin | — | No |
| POST | `/api/admin/registrations/:id/certificate` | Yes | admin | — | Yes (new) |
| POST | `/api/admin/certificates/:id/revoke` | Yes | admin | — | No |
| GET | `/api/employee/dashboard` | Yes | employee | self only | No |
| GET | `/api/admin/dashboard` | Yes | admin | system-wide (by design) | No |

### Security verification results

30 checks executed live against the running server this phase (see full
results in the delivery report): unauthenticated/employee/admin access
control, manipulated `userId`/registration-id/malformed-UUID handling,
invalid/expired JWT, invalid refresh token, SQL-injection-style search
and sort input (verified the `events` table remained intact afterward),
oversized body rejection (413), invalid rating/capacity/date/time,
duplicate registration/feedback/check-in (all still 409), revoked
certificate handling, no raw token exposure, CORS fixed-origin
verification, the four new rate limiters (each confirmed to actually
trigger a 429 at a lowered threshold), production error response safety,
and logout cookie clearing. All passed.

### Known limitations (Phase 12)

1. Rate limiting uses an in-memory store — not distributed-safe across
   multiple instances (documented above, not silently accepted).
2. Refresh-token rotation happens, but there is no persisted reuse
   detection — a genuine architecture addition, out of scope for this
   hardening pass.
3. No CSRF-token layer was added; the existing `sameSite=strict` +
   fixed-origin-CORS + bearer-header architecture was judged sufficient,
   with reasoning documented above rather than added complexity.
4. This hardening pass covers the scope explicitly defined for Phase 12.
   It is not exhaustive penetration testing, and does not constitute a
   claim that the system is "100% secure."

---

## 15. Comprehensive Testing & QA (Phase 13)

"Phase 13 testing and QA completed against the defined verification
scope." This is not a claim of "100% bug free" or "100% secure."

### Test environment

**No separate dedicated test database exists** — this project uses one
PostgreSQL database (`corporate_event_db`) for both development and
automated testing. This is documented as a known limitation, not hidden.
To avoid disturbing real development data, every row this suite creates
is tagged with a unique run id in its title/email
(`P13_<timestamp>_...` / `p13_..._<timestamp>@example.com`), making it
identifiable and safe to clean up afterward — which is done automatically
at the end of a full run (see below).

### Running the suite

```bash
# Rate limits are raised via env vars for this run only — the suite
# intentionally creates far more than 20 accounts/registrations across
# its concurrency tests, which would otherwise trip the Phase 12 rate
# limiters (a sign they're working correctly, not a bug — see below).
#
# Phase 15: employees must now verify their email, so the suite starts a
# local SMTP capture server on port 2526 (scripts/lib/testMailSink.js) and
# the backend must be pointed at it. Every employee the suite creates goes
# through the real register -> emailed code -> verify -> login flow.
TZ=UTC RATE_LIMIT_AUTH=1000 RATE_LIMIT_CHECKIN=1000 RATE_LIMIT_FEEDBACK=1000 RATE_LIMIT_CERTIFICATE=1000 \
RATE_LIMIT_VERIFY_EMAIL=1000 EMAIL_HOST=127.0.0.1 EMAIL_PORT=2526 EMAIL_SECURE=false \
EMAIL_FROM="CEM Test <no-reply@cem.test>" npm run dev
# in a second terminal:
npm run test:phase13
```

> **Run the server in UTC (`TZ=UTC`, which is what Render uses).** Found
> during Phase 15 regression: `event.service.js` formats the stored event
> date with `toISOString()`, which shifts it back one day when the server's
> timezone is ahead of UTC (e.g. Asia/Kolkata). On such a machine the
> Phase 13 check "update event succeeds" fails — identically on the
> pre-Phase-15 code. It is out of Phase 15's scope and was left unchanged;
> it does not affect a UTC server.

### Methodology

A single Node.js script (`backend/scripts/phase13TestSuite.js`) runs
live HTTP requests against the running server **and** queries the
database directly via a PG client to verify final state — concurrency
tests are only counted as passing when the actual database row(s) match
expectations, never just the HTTP status codes. Every check is a
deterministic, repeatable assertion (confirmed by running the full suite
three times in a row with identical 203/203 results each time).

### Results — actual execution, not estimated

```
Total checks: 203
Passed:       203
Failed:       0
Blocked:      0
```

| Section | Checks | Result |
|---|---|---|
| Backend health | 5 | ✅ |
| Authentication | 22 | ✅ |
| Authorization / IDOR | 9 | ✅ |
| Event management | 19 | ✅ |
| Registration + seat allocation (incl. 3 concurrency tests: capacity 1/3/5) | 18 | ✅ |
| QR generation (incl. real image decode) | 12 | ✅ |
| Attendance / check-in (incl. 15-way concurrency test) | 15 | ✅ |
| Speakers | 8 | ✅ |
| Schedule | 9 | ✅ |
| Feedback (incl. 15-way concurrency test) | 13 | ✅ |
| Certificates (incl. 15-way idempotency concurrency test, real PDF check) | 20 | ✅ |
| Employee dashboard | 7 | ✅ |
| Admin dashboard (every metric independently verified against direct SQL) | 20 | ✅ |
| Security regression | 8 | ✅ |
| Database integrity (FK/unique/CHECK/enum constraints) | 8 | ✅ |
| API edge cases | 10 | ✅ |

### Real application bugs found and fixed during this phase

**`event.model.js`'s `findById` crashed with an unhandled 500 on a
malformed (non-UUID) event id.** This exact gap was flagged as a known
limitation back in the Phase 5 report ("the same class of defensive fix
likely applies to `event.model.js` too") but was never implemented at the
time. Phase 13 testing concretely caught it; the same proven fix already
used in `registration.model.js` was applied — a malformed id now returns
a clean 404 instead of leaking a raw PostgreSQL error. This one fix
correctly cascades to all four affected endpoints (`GET`/`PUT`/`PATCH`/
`DELETE` on `/api/events/:id`), since the service layer already calls
`findById` first on every one of them. Verified live on all four.

### Test-script bugs found and fixed (own script, not the application)

Several issues were found and fixed in the test script itself during
development — documented here for transparency, since a good-faith QA
report should distinguish "the app is wrong" from "my test was wrong":
mismatched email casing against the app's correct lowercasing behavior,
a "past deadline" test date that was actually still in the future
relative to the sandbox's current date, two validator-triggering typos
(single-character venue/title strings under the minimum length) that
caused an earlier 400 than the test intended to exercise, one instance of
invalid JS-in-SQL syntax, and a search-filter test that could be pushed
past the default page size by accumulated data from repeated runs.

### Frontend QA

`npm run build` succeeds (725 modules, zero errors). All 12 manually
enumerated routes (public, employee, admin) resolve via the SPA fallback.
**No headless browser is available in this environment** — click-through
UI interaction testing (loading states, modals, form submission flows)
was not performed; this is stated explicitly rather than claimed.

### Regression (Phase 1–12)

All 12 phases re-verified against the live server after cleanup:
health, auth, events, registrations, QR decode, speakers/schedule,
feedback/certificates access, public verification, employee dashboard,
admin dashboard, and confirmation that the Phase 12 rate limiter doesn't
falsely trigger on normal single-request usage. All passed.

### Secret exposure scan

Grepped all backend and frontend source (excluding `node_modules`) for
hardcoded JWT secrets, database passwords, and credential patterns —
none found. `.env` files exist locally for development but are excluded
from the packaged zip and covered by `.gitignore`.

### Known limitations (Phase 13)

1. No dedicated test database — documented above, mitigated with
   uniquely-tagged, auto-cleaned test data.
2. No headless-browser UI click-through testing available in this
   environment.
3. Rate limits must be raised via environment variables to run the full
   concurrency-heavy test suite without tripping Phase 12's protections —
   this is expected interaction between two intentional features, not a
   bug in either.

---

## 16. Production Deployment (Phase 14)

**The application has not been deployed to an actual cloud environment** —
this sandbox has no cloud provider credentials or external network access
to any hosting platform. Everything below was verified as thoroughly as
this environment allows: real commands, run and observed, not just written
down.

### 1. Architecture

```text
Browser
   ↓
React (Vite) frontend — static build, served by any static host
   ↓ HTTPS
Node.js / Express API — single process, stateless (no server-side sessions)
   ↓
PostgreSQL — one database, migrated via node-pg-migrate
```

The backend is a single stateless Express process — any request can be
served by any instance, which is what makes horizontal scaling possible
later (though see the Known Limitations note on rate limiting, which is
currently per-instance, not shared).

### 2. Prerequisites

- Node.js (backend was run/tested on the version in this sandbox; see `package.json` engines if pinned)
- PostgreSQL 13+ (uses `gen_random_uuid()`, native `ENUM` types, `CHECK` constraints)
- npm

### 3. Environment Variables

These are the **actual** variables the application reads — nothing invented.
See `backend/.env.example` (placeholders only, verified to contain no real
secrets):

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | No (defaults 5000) | HTTP port |
| `NODE_ENV` | No (defaults development) | Toggles cookie `secure` flag, error verbosity, placeholder-secret check |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | **Yes** | Used directly by the app's own PostgreSQL pool (`src/config/db.js`) |
| `DATABASE_URL` | Yes (migrations only) | Used by `node-pg-migrate` — must point at the same database as the `DB_*` vars above |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | **Yes** | Token signing |
| `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | No (defaults 15m/7d) | Token lifetimes |
| `BCRYPT_SALT_ROUNDS` | No (defaults 12) | Password hashing cost |
| `CLIENT_URL` | **Yes** | The single allowed CORS origin |
| `RATE_LIMIT_AUTH`, `RATE_LIMIT_REFRESH`, `RATE_LIMIT_CHECKIN`, `RATE_LIMIT_FEEDBACK`, `RATE_LIMIT_CERTIFICATE` | No (sensible defaults) | Per-endpoint rate limits |
| `EMAIL_PROVIDER` | No (defaults `smtp`) | **Phase 15** — `smtp` (Nodemailer) or `brevo` (HTTPS API) |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_FROM` | **Yes in production** (smtp) | **Phase 15** — SMTP relay; server refuses to start in production without them (warning only in development) |
| `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_REQUIRE_TLS` | No | **Phase 15** — SMTP TLS mode / credentials |
| `EMAIL_API_KEY` | **Yes in production** (brevo) | **Phase 15** — Brevo API key |
| `EMAIL_VERIFICATION_SECRET` | No (derived from `JWT_SECRET`) | **Phase 15** — HMAC key for codes at rest |
| `RATE_LIMIT_VERIFY_EMAIL`, `RATE_LIMIT_VERIFY_EMAIL_PER_EMAIL`, `RATE_LIMIT_RESEND_VERIFICATION`, `RATE_LIMIT_RESEND_VERIFICATION_PER_EMAIL` | No (sensible defaults) | **Phase 15** — verification limiters |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Yes (seed script only) | Used once by `npm run seed:admin`, never read by the running server |
| `VITE_API_BASE_URL` (frontend, build-time) | Yes for a non-local deploy | The backend's public URL — **Vite bakes this into the build at `npm run build` time, not at runtime**, so it must be set correctly *before* building, not just on the server |

**Validated at startup (Phase 14, new):** `server.js` now calls
`validateEnv()` before doing anything else. Verified live:
- Missing any of `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD/JWT_SECRET/JWT_REFRESH_SECRET/CLIENT_URL` → the process exits immediately with a clear list of what's missing, before ever binding a port.
- With `NODE_ENV=production`, if `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DB_PASSWORD`, or `ADMIN_PASSWORD` still hold their exact `.env.example` placeholder value → the process refuses to start with an explicit message, rather than silently running production traffic through a known, guessable secret.

### 4. Frontend Setup

```bash
cd frontend
npm install
# Set the backend's real public URL before building:
echo "VITE_API_BASE_URL=https://your-backend-domain.example/api" > .env.production.local
npm run build
```

Verified live: `npm run build` succeeds (725 modules, 0 errors). The
resulting `dist/assets/*.js` was grepped for `JWT_SECRET`, `DATABASE_URL`,
known placeholder values, and `postgres://` connection strings — **none
found**. This is expected: the frontend never reads any backend secret at
all; only `VITE_API_BASE_URL` is baked in.

### 5. Backend Setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in real values
npm run migrate:up
npm run seed:admin      # one time only — safe to re-run, it no-ops if the account exists
npm start                # runs `node server.js`
```

### 6. PostgreSQL Setup

Create an empty database and point `DB_*`/`DATABASE_URL` at it. No manual
schema setup is needed beyond that — migrations create everything.

### 7. Migration Procedure

`npm run migrate:up` runs the full chain via `node-pg-migrate`. **Verified
live against a completely clean, throwaway database** (not the real dev
database): all 9 migrations ran in order successfully, producing:
- 8 tables (`users`, `events`, `registrations`, `speakers`, `event_sessions`, `feedback`, `certificates`, plus `pgmigrations` itself)
- 3 enum types (`user_role`, `event_status`, `registration_status`)
- 7 `updated_at` triggers
- 12 foreign keys
- 37 indexes

**Rollback:** `npm run migrate:down` rolls back exactly the single most
recent migration — **verified live** (rolled back the certificates
migration; confirmed the table was dropped and the migration's row removed
from `pgmigrations`). This is a real, working capability, but it is
**one-step, manual, and forward-only in intent** — there is no automated
multi-step rollback, no point-in-time recovery, and no "rollback on failed
deploy" automation. For anything beyond undoing the single last migration,
restoring from a `pg_dump` backup (below) is the real recovery path.

### 8. Admin Creation

`npm run seed:admin` reads `ADMIN_NAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD` from
`.env` and creates exactly one admin account. **Verified live, run twice
in a row**: the second run detects the existing account by email and exits
cleanly with "Nothing to do" — no duplicate created, and the script never
prints the password back, only name/email/role.

### 9. Production Build

Covered in sections 4–5 above. Both verified live this phase.

### 10. Start Command

Backend: `npm start` (→ `node server.js`). Frontend: build output
(`frontend/dist`) is static files — serve with any static file host or
CDN; there is no frontend server process to start.

### 11. CORS Configuration

`CLIENT_URL` is the single allowed origin — verified live this phase:
- A request with `Origin: http://localhost:5173` (the configured value) gets `Access-Control-Allow-Origin` echoing that same value plus `Access-Control-Allow-Credentials: true`.
- A preflight `OPTIONS` request gets a proper `204` with the expected `Access-Control-Allow-Methods`/`Access-Control-Allow-Headers`.
- A request claiming `Origin: https://evil-attacker.example` gets back the **same fixed configured value**, not its own origin reflected — confirmed by direct comparison of both response headers being byte-identical. A browser enforces the mismatch itself; this is not something a curl request can be used to "bypass," since the enforcement happens client-side in real browsers.

In production, set `CLIENT_URL` to the real frontend origin (e.g.
`https://app.example.com`) — never a wildcard, since credentials are
enabled.

### 12. Cookie / HTTPS Configuration

Refresh-token cookie config (`auth.controller.js`, unchanged from Phase 2,
re-verified this phase): `httpOnly: true`, `secure: NODE_ENV === 'production'`,
`sameSite: 'strict'`, `path: '/api/auth'`, `maxAge` matching the refresh
token's lifetime. **In production, this deployment must run behind HTTPS**
so that `secure: true` cookies are actually sent — deploying with
`NODE_ENV=production` behind plain HTTP would silently break login (the
browser won't send a `Secure` cookie over an insecure connection). Local
development intentionally uses `secure: false` (via `NODE_ENV=development`)
so cookies work over plain `http://localhost` — this difference is
deliberate, not a security compromise, since it only applies locally.

### 13. Health Check

`GET /api/health` — verified live this phase. Response distinguishes
**process liveness** (`server: "ok"`) from **database readiness**
(`database: "connected"`/would report a failure state if the pool were
down) in one endpoint, which is proportionate for this application's
scale; confirmed the response contains no DB host/port/credentials or
other internal details.

### 14. Deployment Steps

1. Provision PostgreSQL; note its connection details.
2. Provision backend hosting (any Node-capable host/container platform).
3. Set all required backend environment variables (section 3).
4. `npm install && npm run migrate:up && npm run seed:admin` (once).
5. Start the backend (`npm start`), behind HTTPS.
6. Build the frontend with `VITE_API_BASE_URL` pointed at the deployed backend's real URL.
7. Deploy the static `frontend/dist` output to a static host/CDN.
8. Confirm `CLIENT_URL` on the backend matches the frontend's real deployed origin exactly.
9. Run the smoke test (below).

### 15. Smoke Test

No cloud deployment exists to smoke-test against real production URLs —
**NOT TESTED — ENVIRONMENT LIMITATION**. In its place, the full local
verification performed this phase (and the complete 203-check Phase 13
suite, re-run this phase with identical results) exercises every
functional flow the smoke test would cover: registration, login, refresh,
logout, event CRUD, registration/seat allocation, QR generation and
decode, check-in and duplicate-rejection, feedback and duplicate-rejection,
certificate generation/download/verification/revocation, and both
dashboards. This is real local verification, not a substitute claim of
production verification.

### 16. Backup Procedure

**RECOMMENDED / MANUAL — not automated or currently configured.**

```bash
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -Fc corporate_event_db > backup_$(date +%Y%m%d_%H%M%S).dump
```

`-Fc` (custom format) supports selective restore and is generally smaller
than plain SQL. Schedule this via cron/your platform's scheduled-job
feature — nothing in this codebase runs it automatically.

### 17. Restore Procedure

**RECOMMENDED / MANUAL.**

```bash
pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d corporate_event_db --clean --if-exists backup_20260101_120000.dump
```

After restoring, run `npm run migrate:up` to apply any migrations created
after the backup was taken.

### 18. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Server exits immediately on startup with a "missing environment variable" message | A required var (section 3) is unset — check `.env` |
| Server exits with a "placeholder value" message | `NODE_ENV=production` but a `.env.example` default was never replaced |
| Login works but refresh silently fails in production | Backend not actually served over HTTPS — `secure` cookies aren't sent over plain HTTP |
| CORS errors in browser console | `CLIENT_URL` doesn't exactly match the frontend's real deployed origin |
| Frontend calls the wrong backend / calls localhost in production | `VITE_API_BASE_URL` wasn't set before running `npm run build` — it must be rebuilt, not just reconfigured at runtime |

### 19. Security Notes

Covered in full in the Phase 12 section above; unchanged and re-verified
this phase (CORS, cookies, rate limiting, error handling, dependency
audit — all re-checked live, all still passing).

### 20. Known Limitations (Phase 14)

1. **Not cloud-deployed** — no deployment credentials/environment available in this sandbox.
2. **Migration rollback is single-step and manual** — verified working, but not a full rollback/recovery automation.
3. **Backups are manual/recommended, not automated** — no scheduled backup job exists in this codebase.
4. **Rate limiting remains in-memory per-process** (documented since Phase 12) — a real multi-instance deployment would need a shared store (e.g. Redis) for this to be effective; not implemented here.
5. **Health endpoint is a single combined liveness+readiness check** — sufficient for this application's current scale; a larger deployment might eventually want them split, but that wasn't justified here.
6. **Observability beyond the health endpoint and console logs is not implemented** — see the Observability checklist for exactly what's marked RECOMMENDED vs IMPLEMENTED (not shown here in the README for brevity; see `docs/DEPLOYMENT_RUNBOOK.md`).

---

## 17. Email Verification (Phase 15)

"Phase 15 email verification completed against the defined verification
scope." This is not a claim of "100% secure".

### Authentication flow (final)

```
Register ──► account created as EMPLOYEE, email_verified = false
   │          6-digit code emailed (no access/refresh token issued)
   ▼
Verify email (POST /api/auth/verify-email) ──► email_verified = true
   ▼
Password login ──► JWT access token (memory) + httpOnly refresh cookie
   ▼
Existing RBAC (admin / employee) — unchanged
```

bcrypt, JWT access tokens, the httpOnly refresh-token cookie, token
refresh, logout and RBAC are all unchanged. Email verification is an
additional gate:

| Where | Unverified account gets |
|---|---|
| `POST /api/auth/login` (after the password matched) | `403 { code: "EMAIL_NOT_VERIFIED", message: "Please verify your email before signing in." }` — no token, no cookie, no role |
| `POST /api/auth/refresh-token` | `403 EMAIL_NOT_VERIFIED` — an old refresh cookie can't keep a session alive |
| Any protected API (`authenticate` middleware) | `403 EMAIL_NOT_VERIFIED` — even a still-valid older access token is refused |

The database is the source of truth; nothing the frontend says about
verification is trusted.

### Verification code rules

| Rule | Value / mechanism |
|---|---|
| Format | exactly 6 digits, `crypto.randomInt` (OS CSPRNG) — never `Math.random()` or timestamps |
| Storage | only `HMAC-SHA256(key, "<userId>:<code>")` is stored. `key` = `EMAIL_VERIFICATION_SECRET`, or a domain-separated derivation of `JWT_SECRET` if unset. A database dump alone can't brute-force the 10⁶ codes offline. Compared with `timingSafeEqual`. |
| Expiry | **10 minutes** (database clock) |
| Single use | `used_at` set on success; replay → `401 INVALID_CODE` |
| Max attempts | **5** wrong attempts per code, then the code is invalidated → `429 TOO_MANY_ATTEMPTS`, user must request a new code. Counter updates happen under a row lock and are committed even on failure (parallel guessing can't exceed 5). Counters are never revealed. |
| Resend cooldown | **60 seconds** (`429 RESEND_COOLDOWN` + `Retry-After` + `retryAfterSeconds`) |
| Resend | invalidates every previous active code before issuing a new one |
| One active code | partial unique index `(user_id) WHERE used_at IS NULL AND invalidated_at IS NULL` |
| Cleanup | used/invalidated/expired rows older than 24 h are deleted hourly by the server and via `npm run cleanup:verification-codes` |
| Never | logged, returned in any JSON response, or stored raw |

### Endpoints

**`POST /api/auth/register`** → `201`
```json
{ "success": true, "message": "Registration successful. Please verify your email.",
  "data": { "email": "p*******@example.com", "emailSent": true, "verificationRequired": true,
            "codeExpiresInMinutes": 10, "resendCooldownSeconds": 60 } }
```

**`POST /api/auth/verify-email`** `{ "email", "code" }`
- `200` `{ message: "Email verified successfully. You can now sign in.", data: { email (masked), emailVerified: true } }`
- `400` invalid format / unexpected fields (`.strict()` Zod), `401 INVALID_CODE` (wrong/used/unknown email — identical response), `401 CODE_EXPIRED`, `409 ALREADY_VERIFIED`, `413` body > 2 KB, `429 TOO_MANY_ATTEMPTS` / `RATE_LIMITED`

**`POST /api/auth/resend-verification`** `{ "email" }`
- Always `200 "If the account requires verification, a new code has been sent."` for unknown, deactivated and already-verified addresses (no enumeration). Email delivery runs after the response so timing doesn't leak either.
- `429 RESEND_COOLDOWN` within 60 s — applied to **every** address, existing or not.

### Rate limiting (in-memory, same store as Phase 12)

| Endpoint | Per IP | Per email address |
|---|---|---|
| `/auth/register`, `/auth/login` | 20 / 15 min (`RATE_LIMIT_AUTH`, unchanged) | — |
| `/auth/verify-email` | 20 / 15 min (`RATE_LIMIT_VERIFY_EMAIL`) | 10 / 15 min (`RATE_LIMIT_VERIFY_EMAIL_PER_EMAIL`) |
| `/auth/resend-verification` | 10 / 15 min (`RATE_LIMIT_RESEND_VERIFICATION`) | 5 / 60 min (`RATE_LIMIT_RESEND_VERIFICATION_PER_EMAIL`) + 60 s cooldown |

Like every limiter since Phase 12, these counters live in process memory:
correct for the current single-instance Render deployment, but not shared
across multiple instances and reset on restart (the 60 s cooldown is also
enforced from the database, so it survives restarts). No Redis was added.

### Email provider configuration

All settings are backend environment variables (placeholders in
`backend/.env.example`). Nothing email-related exists in the frontend.

| Variable | Notes |
|---|---|
| `EMAIL_PROVIDER` | `smtp` (default, Nodemailer) or `brevo` (HTTPS API) |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD` | SMTP relay (`EMAIL_SECURE=true` for port 465, `false` for STARTTLS on 587/2525) |
| `EMAIL_REQUIRE_TLS` | optional; defaults to `true` in production when `EMAIL_SECURE=false` |
| `EMAIL_API_KEY` | Brevo API key (`EMAIL_PROVIDER=brevo`) |
| `EMAIL_FROM` | e.g. `Corporate Event Management <no-reply@yourdomain.com>` — must be a sender verified with your provider |
| `EMAIL_VERIFICATION_SECRET` | optional HMAC key for codes at rest |

In production the server refuses to start if email isn't configured; in
development it starts with a loud warning.

> **Render free tier:** since September 2025 Render's free web services
> block outbound SMTP on ports 25, 465 and 587. On a free instance use
> `EMAIL_PROVIDER=brevo` + `EMAIL_API_KEY` (HTTPS, port 443), or an SMTP
> relay on port 2525 (Brevo, SendGrid and Mailgun offer it). Paid Render
> instances can use any SMTP port. Gmail SMTP (app password, port 465/587)
> works only on a paid instance.

**Render setup:** backend service → Environment → add the `EMAIL_*`
variables → redeploy → run `npm run migrate:up` (adds migration
`1700000000010`). Never put these in GitHub or in the frontend service.

### Email content

Subject: *Verify your Corporate Event Management account*. Plain-text and
HTML versions containing the app name, the user's name, the code, the
10-minute expiry, a "never share this code" notice and "If you did not
create this account, you can safely ignore this email." No password,
token, internal id or database detail.

### Email delivery failure

The account and its first code are created in one transaction; the email
is sent after commit. If sending fails, the account stays **pending** (the
address stays reserved — `users.email` is UNIQUE, so no duplicate account
can ever be created), the undeliverable code row is deleted, the cooldown
is cleared, and the response says
`emailSent: false` / "please request a new code". The user presses
**Resend code** once delivery works. Failures are logged as one sanitized
line with a masked address — never the body or credentials.

### Existing accounts (migration `1700000000010_add-email-verification`)

- The migration only **adds** columns/tables: names, emails, password
  hashes, roles, departments/designations, registrations, attendance,
  feedback and certificates are untouched (verified with a before/after
  fingerprint of every user row).
- **Admins** (created by the trusted `seed:admin` script) are marked
  verified — admin login keeps working immediately. `seed:admin` now
  creates verified admins.
- **Existing employees** get a one-time verification requirement: their
  next login shows "Your email is not verified" with **Resend Code** →
  they receive a code → verify → log in with their unchanged password.
- Operator fallback for an employee whose mailbox can't receive mail:
  `npm run verify:user -- someone@company.com` (server-side only, like
  `seed:admin`).
- Rollback: `npm run migrate:down` removes the table and the two columns.

### Frontend

- `/verify-email` — masked address, 6-box code input (paste, mobile
  one-time-code autofill), Verify button, Resend with live countdown,
  loading / error / success states, "use a different email" when opened
  directly. The full address travels only in in-memory router state,
  never in the URL.
- Register → redirects to `/verify-email` (no longer signs in).
- Login → for `EMAIL_NOT_VERIFIED` shows "Your email is not verified." with
  **Verify Email** and **Resend Code**; after verifying, shows a green
  "Email verified" banner with the email prefilled.

### Tests (actually executed)

```bash
cd backend
npm run test:phase15     # starts its own SMTP server + backend; ~1.5 min (real 60 s cooldown wait)
```

`scripts/phase15EmailVerificationTest.js` spawns the real backend with a
real authenticated SMTP capture server, drives the HTTP API, reads codes
from the delivered emails, and checks PostgreSQL directly. It also scans
the backend's complete stdout/stderr and every API response body for
every issued code, the SMTP password and stored hashes, and scans the
built frontend for email settings.

**Results — actual execution, not estimated:**

| Suite / check | Environment | Result |
|---|---|---|
| `npm run test:phase15` | development DB containing an employee created by the **pre-Phase-15** code (exercises the existing-account path) | **170 passed, 0 failed** |
| `npm run test:phase15` | brand-new database, project extracted from the final ZIP (the 9 existing-account checks don't apply there) | **161 passed, 0 failed** |
| `npm run test:phase13` (Phase 1–14 regression, now via the real verification flow) | extracted ZIP, fresh DB, `TZ=UTC` | **203 passed, 0 failed** |
| `npm run test:qr` | extracted ZIP | pass |
| Backend syntax check (`node --check`, 94 files) | extracted ZIP | 0 errors |
| Frontend `npm run build` | extracted ZIP | success, 728 modules; `oxlint`: no new warnings (same 5 pre-existing) |
| Migrations | fresh DB | 10/10 applied in order, re-run is a no-op, `migrate:down`/`up` of 1700000000010 verified; existing user rows byte-identical before/after (md5 fingerprint) |
| Browser walk-through (Playwright, Chromium) | built frontend + backend + SMTP capture | register → verify page → wrong code → cooldown → paste code → verified → login → dashboard; unverified-login panel → Resend → verify page; direct visit |

Required checks → suite sections (all in the 170-check run):

| # | Check | Section | # | Check | Section |
|---|---|---|---|---|---|
| 1 | registration sends email | 01-Register (23) | 14 | duplicate registration blocked (incl. 6 concurrent) | 14-Duplicate (5) |
| 2 | invalid email rejected | 02-InvalidEmail (3) | 15 | inactive account remains blocked | 15-Inactive (5) |
| 3 | invalid code rejected | 03-InvalidCode (4) | 16 | admin login works | 16-AdminLogin (3) |
| 4 | valid code accepted | 04-ValidCode (7) | 17 | employee login/features work | 17-EmployeeLogin (3), 11-Existing, Phase 13 suite |
| 5 | expired code rejected | 05-Expired (5) | 18 | code never in API responses | 18-NoCodeInResponses (2) |
| 6 | reused code rejected | 06-Reuse (3) | 19 | code never in logs | 19-NoCodeInLogs (4) |
| 7 | wrong-attempt counter | 07-Attempts (4) | 20 | SMTP credentials never in frontend | 20-NoSecretsInFrontend (4) |
| 8 | max attempts (incl. parallel guesses) | 08-MaxAttempts (6) | 21 | malformed code rejected | 21-Malformed (12) |
| 9 | resend works | 09-Resend (5) | 22 | unexpected JSON fields | 22-UnexpectedFields (9) |
| 10 | resend cooldown | 10-Cooldown (7) | 23 | oversized request rejected | 23-Oversized (5) |
| 11 | old code invalid after resend | 11-OldCodeInvalid (1), 09-Resend | 24 | verify rate limit | 24-VerifyRateLimit (4) |
| 12 | unverified login blocked | 12-UnverifiedLogin (7) | 25 | resend rate limit | 25-ResendRateLimit (4) |
| 13 | verified login succeeds | 13-VerifiedLogin (7) | + | delivery failure, existing accounts, cleanup, Brevo provider, production config fail-fast | 18b, 11-Existing, Cleanup, Provider-Brevo, Config |

**Bugs found during Phase 15 testing**

- *Application (fixed):* the browser walk-through showed that the
  frontend couldn't read the `Retry-After` header on a 429 (browsers hide
  it from cross-origin JS unless CORS exposes it), so "Resend Code" during
  the cooldown showed an error instead of a countdown. Fix: the error body
  now also carries `retryAfterSeconds`; a check for it was added
  (10-Cooldown).
- *Test script (own mistakes, fixed):* two expected masked-email strings
  had the wrong number of `*`, and a "captured enough codes" threshold was
  too strict for repeat runs.
- *Pre-existing, not fixed:* the timezone issue in event date handling
  noted in the Phase 13 section.

### Known limitations (Phase 15)

1. **Not verified against a real external email provider** from this
   sandbox (no provider credentials). SMTP delivery was verified against a
   real local SMTP server with AUTH; the Brevo provider was verified
   against a local stand-in for its HTTPS endpoint (request shape,
   headers, error handling). Do one real registration after configuring
   Render to confirm delivery.
2. **In-memory rate limits/cooldown map** — see above; single instance only.
3. **Email squatting**: anyone can register an address they don't own; it
   stays unverified and unusable, but the real owner then gets
   "An account with this email already exists" (the pre-existing 409
   behavior was kept). An operator can delete such a pending row.
4. **Register still reveals whether an email is registered (409)** — that
   is pre-existing Phase 2 behavior and was kept; the new verify/resend
   endpoints add no further enumeration beyond it (verify answers "already
   verified" with 409 for an address that's verified).
5. **Existing employees are blocked until they verify once.** If email
   isn't configured on Render when this deploys, they can't get a code —
   configure email before (or together with) running the migration.
6. **Pre-existing dependency advisories** — `npm audit --omit=dev` reports
   3 advisories (`proxy-addr`, `brace-expansion`, `ip-address`) that are
   present identically in the pre-Phase-15 lockfile (published after
   Phase 14's clean audit). `npm audit fix` resolves them; left for a
   dedicated dependency-update change rather than mixed into this phase.
7. **Pre-existing timezone bug** in event date handling on servers ahead
   of UTC (see the Phase 13 section) — unrelated to this phase, not fixed.

---

## 18. Running Both Together

You need **two terminals** open at the same time:

```bash
# Terminal 1
cd corporate-event-management/backend
npm run dev

# Terminal 2
cd corporate-event-management/frontend
npm run dev
```

Backend → http://localhost:5000
Frontend → http://localhost:5173

**Phase 15:** registering needs working email. For local development the
easiest option is [Mailpit](https://mailpit.axllent.org/) (a local SMTP
server with a web inbox): run it, then set `EMAIL_HOST=127.0.0.1`,
`EMAIL_PORT=1025`, `EMAIL_SECURE=false`, `EMAIL_FROM="CEM Dev <dev@localhost>"`
in `backend/.env` and read codes at http://localhost:8025. (An operator can
also skip the code for one account with `npm run verify:user -- <email>`.)

---

## What's Implemented So Far

**Phase 1 — Project Setup**
- [x] Root project with `/frontend` and `/backend`
- [x] Production-style backend folder structure (controllers, routes,
      middleware, models, services, utils, config)
- [x] Express server with CORS, JSON body parsing
- [x] Centralized error handling (`errorHandler` + `notFoundHandler`)
- [x] PostgreSQL connection pool (`src/config/db.js`)
- [x] `GET /api/health` — reports server + database status
- [x] React + Vite + Tailwind CSS + React Router + Axios frontend
- [x] `.env` / `.env.example` for both frontend and backend
- [x] `.gitignore`

**Phase 2 — Authentication**
- [x] `users` table via a version-controlled migration (`node-pg-migrate`)
- [x] bcrypt password hashing, JWT access + refresh tokens
- [x] `POST /api/auth/register` (always creates an employee)
- [x] `POST /api/auth/login` (shared by both roles)
- [x] `GET /api/auth/me`, `POST /api/auth/refresh-token`, `POST /api/auth/logout`
- [x] `authenticate` middleware (JWT verification, re-checks `is_active`
      on every request) and `authorize(...roles)` middleware
- [x] Zod request validation, rate limiting on auth endpoints, helmet
      security headers
- [x] Admin account seeding via `npm run seed:admin` (no public admin
      registration endpoint)
- [x] Frontend: `/login`, `/register`, `AuthContext`, `ProtectedRoute`,
      `RoleRoute`, role-based redirect after login, silent session
      restore on page refresh, placeholder Admin/Employee dashboards

**Phase 3 — Event Management**
- [x] `events` table via migration (status enum, CHECK constraints, FK, indexes)
- [x] Reusable `set_updated_at` trigger (also retrofitted onto `users`)
- [x] Admin: create, list (filter/search/paginate/sort), view, edit, publish/
      unpublish/cancel/complete (state machine), delete (draft-only)
- [x] Employee: browse published events, view details (drafts hidden as 404)
- [x] Zod validation, role-based authorization, clean error handling
- [x] Frontend: admin events list/detail/create/edit pages, employee events
      list/detail pages, status badges, pagination, confirm dialogs, toasts,
      loading/empty/error states

**Phase 4 — Employee Registration & Seat Allocation**
- [x] `registrations` table (status enum, partial unique indexes for
      duplicate-registration and duplicate-seat prevention, FKs, indexes)
- [x] Concurrency-safe registration via `SELECT ... FOR UPDATE` row locking
      inside a single transaction — proven with a real parallel-request
      test script, not just sequential calls
- [x] Automatic gap-filling seat allocation (`A-01, A-02, ...`)
- [x] QR token generated and stored per registration (image rendering is
      Phase 6)
- [x] Duplicate registration, capacity-full, deadline-passed, non-published
      event, and nonexistent event all correctly rejected
- [x] Cancellation (soft-delete, ownership-enforced) with seat reuse on
      re-registration
- [x] Frontend: register/cancel flow on event detail page, "My
      Registrations" page with status filter and pagination

**Phase 5 — QR Code Generation**
- [x] `qrcode` library integrated in an isolated service layer
      (`src/services/qr.service.js`)
- [x] QR encodes only the existing random registration token — no PII
- [x] Deterministic generation verified (identical output for the same
      token, called twice)
- [x] No new DB columns — image generated on demand, token unchanged
      (`created_at === updated_at` verified after repeated QR requests)
- [x] Ownership enforced from the JWT-derived identity, never the URL;
      IDOR attempt correctly rejected (403)
- [x] Cancelled registrations correctly refused (409)
- [x] Decode-verification test: real QR image decoded back to the exact
      DB-stored token using `jsqr` + `pngjs`
- [x] Fixed a real bug found during testing: malformed (non-UUID)
      registration IDs no longer crash with a raw DB error (500) — now
      correctly treated as 404
- [x] Frontend: QR shown inline on event detail page and via a modal on
      My Registrations, both with a working download link

**Phase 6 — QR Scanning + Instant Attendance**
- [x] `checked_in_at` column added via migration (no new attendance table —
      reused the existing `registration_status` enum's `CHECKED_IN` value)
- [x] `POST /api/registrations/check-in` — admin-only, row-locked
      transaction, atomic conditional update
- [x] Full state-transition matrix enforced (REGISTERED→CHECKED_IN allowed;
      CANCELLED/CHECKED_IN/COMPLETED→CHECKED_IN all blocked with 409)
- [x] Event-level rule: only PUBLISHED events accept check-ins
- [x] Concurrency proven: 15 simultaneous requests against the same token
      → exactly 1 success, 14 clean 409s, verified in DB
- [x] Token never returned in responses, never logged (verified via log
      grep across all test runs)
- [x] Malformed-ID defensive fix (from Phase 5 review) also protects this
      phase's lookups
- [x] Frontend: `/admin/check-in` scanner page using `html5-qrcode`
      (confirmed NOT using native BarcodeDetector by default), start/stop/
      pause/resume controls, clear success/error states, admin-only nav
      link + route guard

**Phase 7 — Speakers + Event Schedule**
- [x] `speakers` table (FK to events, CASCADE) and `event_sessions` table
      (FK to events CASCADE, FK to speakers SET NULL, CHECK end>start)
- [x] Full CRUD for both, admin-only mutations, employee read-only
- [x] Employee draft-event visibility blocked (404), published visible
- [x] Cross-reference validation: speaker must belong to the same event;
      session time must fall within the event's own hours
- [x] Partial-update merge-validation applied proactively (same fix
      pattern as Phase 3) — verified working before any bug shipped
- [x] Terminal-state (cancelled/completed) blocks all speaker/schedule
      mutations, tested across create/update/delete
- [x] `ON DELETE SET NULL` behavior explicitly verified: deleting a
      speaker preserves their sessions, just clears the speaker reference
- [x] Two bugs caught and fixed during implementation (see verification
      report): a time-string comparison bug at exact hour boundaries, and
      proactive application of the Phase 3 partial-update lesson
- [x] Frontend: Speakers and Schedule sections on both admin and employee
      event detail pages, with add/edit/delete forms and confirmation
      dialogs for admins

**Phase 8 — Event Feedback System**
- [x] `feedback` table: `CHECK (rating BETWEEN 1 AND 5)`, `UNIQUE(event_id,
      user_id)`, FKs to events/users/registrations, indexes on all three
- [x] Eligibility strictly derived from the employee's own registration
      status (CHECKED_IN/COMPLETED only) — never trusts any client-supplied
      identity or registration reference
- [x] Event-state rule: DRAFT/CANCELLED blocked, PUBLISHED/COMPLETED
      allowed (feedback expected mainly *after* an event is completed)
- [x] Duplicate prevention: DB unique constraint + Postgres error-code
      (23505) handling — no row locking needed, verified with 12
      simultaneous same-employee submissions → exactly 1 success, 11
      clean 409s, confirmed in DB
- [x] Admin summary computed live from the database (no stored
      aggregates), cross-checked against direct SQL — exact match
- [x] Frontend: employee star-rating form with submitted/eligible/
      not-eligible states; admin summary with distribution bars and
      per-response list

**Phase 9 — Certificate Generation & Verification**
- [x] `certificates` table: `UNIQUE(registration_id)`, `UNIQUE(certificate_number)`,
      `UNIQUE(verification_token)`, FKs (RESTRICT — treated as permanent
      records, unlike sibling tables that cascade from events)
- [x] Eligibility (CHECKED_IN/COMPLETED only), idempotent get-or-create,
      ownership-enforced employee endpoint, admin bypass for its own endpoint
- [x] Real PDFKit-generated PDF, in-memory only (no disk storage), manually
      inspected and QR-decoded from the actual rendered file
- [x] Public verification endpoint — safe fields only, no raw token exposure
- [x] Revocation: one-way, idempotent-safe, employee download blocked,
      admin download retained for audit
- [x] Idempotency proven: 15 simultaneous requests for the same
      registration → all succeeded, all converged to one certificate row
- [x] Two real bugs found and fixed during testing: an IDOR vulnerability
      (employee could fetch another employee's certificate via registration
      ID) and a route-mounting-order bug that broke the public verify
      endpoint — see the verification report for full details
- [x] Frontend: My Certificates page, admin Certificates page (paginated,
      filterable, revoke action), public `/verify/certificate/:token` page,
      certificate availability shown on the employee event detail page

**Phase 10 — Employee Dashboard**
- [x] `GET /api/employee/dashboard` — aggregated, employee-only, identity
      from JWT only (query-param userId manipulation tested and ignored)
- [x] Reuses Phase 4/6's `registrationModel.listForUser` and Phase 9's
      `certificateService.listMyCertificates` directly — zero duplicated
      business logic
- [x] Two new batched queries (feedback status, schedule/speaker info)
      avoid N+1 — verified no per-item loops in the implementation
- [x] All 5 summary counts verified to exactly match direct `COUNT(*)`
      SQL queries against the same tables
- [x] Cross-employee isolation verified: two employees sharing the same
      public event each see only their own distinct registration row
- [x] Recent activity built entirely from real, already-fetched
      timestamps — no fabricated data
- [x] Frontend: welcome header, 5 summary cards, upcoming events (with
      schedule/speaker snippets), registrations, certificates, and
      recent activity — reuses existing `QrModal` and links out to the
      existing feedback UI rather than duplicating either

**Phase 11 — Admin Dashboard + Analytics**
- [x] `GET /api/admin/dashboard` — admin-only, validated `days`/`status`
      filters, zero fabricated data
- [x] Found and fixed an Express-5-specific bug: `req.query` reassignment
      silently no-ops (read-only getter); fixed via a new `req.validatedQuery`
      property, isolated to this phase's new files only
- [x] Every summary metric independently verified to exactly match direct
      `COUNT(*)`/`AVG()` SQL against the same tables
- [x] Registration/attendance trends: real timestamps, zero-filled,
      attendance provably never double-counted (single nullable column)
- [x] Event performance, popular events, and capacity utilization all
      derived from one shared aggregate query (no repeated expensive queries)
- [x] Consistent, division-by-zero-safe `attendanceRate` definition used
      everywhere in the response
- [x] SQL-injection-style filter input tested and confirmed rejected
      (400) before reaching any query; `events` table confirmed intact
- [x] Frontend: summary cards, registration/attendance trend line charts,
      event status pie chart, feedback bar chart, event performance table,
      popular events, certificate overview, recent events — using
      `recharts`, with proper empty states throughout

**Phase 12 — Security Hardening**
- [x] Full audit of authentication, RBAC, input validation, SQL safety,
      Express config, rate limiting, cookies, CORS, QR/certificate
      security, error handling, headers, frontend, secrets, and dependencies
- [x] Extended rate limiting to refresh-token, check-in, feedback, and
      certificate generation/download/verify (previously only login/register) —
      each confirmed live to actually trigger a 429 at a lowered threshold
- [x] Explicit, documented body size limits (200kb) — verified a ~300KB
      payload is correctly rejected (413)
- [x] `npm audit`: 0 vulnerabilities in both backend and frontend
- [x] Confirmed CORS does not reflect arbitrary origins back (fixed
      allow-list only) and production error responses hide all internal
      detail (verified live in both dev and production modes)
- [x] Complete route security matrix documented (every endpoint: auth,
      role, ownership, rate limit)
- [x] 30 live security verification checks — all passed
- [x] Two limitations found and explicitly documented rather than
      silently patched over: in-memory rate limiting (not distributed-safe)
      and no persisted refresh-token reuse detection — both require real
      infrastructure additions outside this phase's hardening scope

**Phase 13 — Comprehensive Testing & QA**
- [x] 203 real, executed checks (203 pass, 0 fail) across all 16 phases'
      functionality — well above the 100-check minimum, no artificially
      inflated duplicate assertions
- [x] All concurrency tests (registration ×3, check-in, feedback,
      certificates) verify final DATABASE state directly, not just HTTP
      status codes
- [x] Every admin dashboard metric independently verified against direct
      SQL in this phase (in addition to Phase 11's own verification)
- [x] Found and fixed one real, previously-documented-but-unfixed
      application bug (`event.model.js` malformed-UUID 500 crash) —
      the same class of bug already fixed in `registration.model.js` back
      in Phase 5, finally applied here
- [x] Programmatic route-security audit: every `/admin` route confirmed
      to have explicit `authorize('admin')`; public verify route
      confirmed to have no `authenticate` middleware
- [x] Secret-exposure scan across all source: none found
- [x] Suite confirmed deterministic/repeatable (3 consecutive full runs,
      identical 203/203 result each time)
- [x] Test data auto-cleaned after each run (uniquely tagged, FK-safe
      deletion order, verified real dev data untouched)
- [x] Frontend build + all 12 routes re-verified

**Phase 14 — Deployment & Production Readiness**
- [x] Environment validation at startup — verified live: missing required
      vars fail fast with a clear message; production-mode placeholder
      secrets (e.g. an unedited `.env.example` value) also fail fast
- [x] Graceful shutdown (SIGTERM/SIGINT) — verified live via `timeout`'s
      real SIGTERM: HTTP server stops accepting new connections, DB pool
      closes, process exits cleanly
- [x] Full migration chain (9 migrations) verified live against a
      brand-new, throwaway database — all tables/enums/triggers/FKs/indexes
      confirmed present; single-step rollback also verified live
- [x] Admin seed script confirmed idempotent live (second run detects
      existing account, creates no duplicate, never logs the password)
- [x] CORS verified live: valid origin, preflight, and non-reflection of
      an unauthorized origin
- [x] Health endpoint confirmed to leak no credentials/internal details
- [x] `npm run build` output scanned for secrets — none found; confirmed
      `VITE_API_BASE_URL` must be set at build time, not runtime
- [x] Phase 13's full 203-check suite re-run after Phase 14 changes —
      identical 203/203, no regression
- [x] Dependency audit re-run on both backend and frontend — 0
      vulnerabilities
- [x] **Not actually cloud-deployed** — no deployment credentials/access
      available in this sandbox; stated explicitly, not glossed over

**Phase 15 — Email Verification Code / OTP**
- [x] `users.email_verified` / `email_verified_at` + `email_verification_codes`
      table (FK, indexes, one-active-code-per-user partial unique index)
- [x] Cryptographically random 6-digit codes, HMAC-SHA256 at rest, 10-minute
      expiry, single use, 5-attempt lockout, 60 s resend cooldown
- [x] Registration creates an unverified account and emails the code (no
      token issued); login/refresh/protected APIs refuse unverified accounts
- [x] `POST /api/auth/verify-email`, `POST /api/auth/resend-verification`
      with strict Zod validation, per-IP + per-email rate limits, 2 KB body cap
- [x] Email via Nodemailer SMTP or Brevo HTTPS API (Render free tier blocks SMTP)
- [x] Existing admins migrated as verified; existing employees verify once
      (data untouched); `npm run verify:user` operator path
- [x] Frontend `/verify-email` page, register → verify → login flow,
      unverified-login panel with Verify / Resend
- [x] `npm run test:phase15` — real SMTP + real backend + real PostgreSQL
- [x] Phase 13 regression suite updated to the real verification flow

## Not Implemented Yet

All 15 planned phases are now implemented. The application has **not**
been deployed to an actual cloud/production environment (no credentials
available in this sandbox) — see the Production Deployment section and
the final Phase 14 report for the exact, honest scope of what was and
was not verified.

---

## Version Control

```bash
cd corporate-event-management
git init
git add .
git commit -m "chore: initial project setup (backend + frontend skeleton)"
```

Then create a repository on GitHub and push:

```bash
git remote add origin <your-github-repo-url>
git branch -M main
git push -u origin main
```
