/**
 * PHASE 15 — Email verification code / OTP test suite.
 *
 * Executes real behavior end to end — no mocks of the code under test:
 *   - starts a real SMTP capture server (scripts/lib/testMailSink.js) that
 *     requires AUTH, like a real relay;
 *   - spawns the REAL backend (`node server.js`) as a child process pointed
 *     at that SMTP server, capturing all of its stdout/stderr so the logs
 *     can be scanned for leaked codes/credentials;
 *   - drives it over HTTP exactly as the frontend does, reads each code
 *     from the delivered email, and checks state directly in PostgreSQL.
 *
 * Per-IP rate limits are isolated per scenario by sending a distinct
 * X-Forwarded-For (the app trusts exactly one proxy hop, as on Render).
 *
 * Takes ~1.5 minutes: the 60-second resend cooldown is waited out for real.
 *
 * Prerequisites: PostgreSQL migrated (npm run migrate:up), admin seeded
 * (npm run seed:admin), frontend built (for the bundle secret scan).
 * Nothing else may be listening on TEST_API_PORT / TEST_SMTP_PORT.
 *
 * Run with: npm run test:phase15
 */

process.env.TZ = 'UTC'; // match server.js
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { startMailSink } = require('./lib/testMailSink');
const { buildConnectionConfig } = require('../src/config/db');

const BACKEND_DIR = path.join(__dirname, '..');
const FRONTEND_DIR = path.join(BACKEND_DIR, '..', 'frontend');
const API_PORT = parseInt(process.env.TEST_API_PORT, 10) || 5055;
const SMTP_PORT = parseInt(process.env.TEST_SMTP_PORT, 10) || 2526;
const BASE_URL = `http://127.0.0.1:${API_PORT}/api`;
const RUN_ID = Date.now();
const SMTP_USER = 'p15-smtp-user';
const SMTP_PASS = `P15-smtp-secret-${crypto.randomBytes(9).toString('hex')}`;
// Same account `npm run seed:admin` creates — never hardcode credentials.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (the seeded admin account) before running this suite.');
  process.exit(1);
}
const PASSWORD = 'VerifyMe123';

// Same connection settings as the app itself (DATABASE_URL or DB_*).
const pool = new Pool(buildConnectionConfig());
const db = (text, params) => pool.query(text, params);

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------
let passCount = 0;
let failCount = 0;
const failures = [];
const sections = {};
const check = (section, name, condition, details) => {
  sections[section] = sections[section] || { pass: 0, fail: 0 };
  if (condition) {
    passCount += 1;
    sections[section].pass += 1;
  } else {
    failCount += 1;
    sections[section].fail += 1;
    failures.push({ section, name, details: details || '' });
    console.log(`  FAIL [${section}] ${name} — ${details || ''}`);
  }
};

// ---------------------------------------------------------------------------
// HTTP helper — every raw response body is retained so the suite can
// prove no verification code ever appeared in any API response.
// ---------------------------------------------------------------------------
const allResponseBodies = [];
let ipCounter = 10;
const freshIp = () => {
  ipCounter += 1;
  return `10.15.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
};

const api = async (method, urlPath, { token, body, rawBody, cookie, ip } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  if (ip) headers['X-Forwarded-For'] = ip;
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers,
    body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  allResponseBodies.push(text);
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, headers: res.headers, json, text };
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Backend child process
// ---------------------------------------------------------------------------
let backendLog = '';
const startBackend = (extraEnv = {}) => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      PORT: String(API_PORT),
      NODE_ENV: 'development', // most verbose error output (stack traces) — strictest log scan
      EMAIL_PROVIDER: 'smtp',
      EMAIL_HOST: '127.0.0.1',
      EMAIL_PORT: String(SMTP_PORT),
      EMAIL_SECURE: 'false',
      EMAIL_USER: SMTP_USER,
      EMAIL_PASSWORD: SMTP_PASS,
      EMAIL_FROM: 'Corporate Event Management <no-reply@corporate-event.test>',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => {
    backendLog += d.toString();
  });
  child.stderr.on('data', (d) => {
    backendLog += d.toString();
  });
  return child;
};

const waitForHealth = async () => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }
  return false;
};

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------
let sink;
const issuedCodes = new Set();

const register = async (name, email, ip = freshIp()) =>
  api('POST', '/auth/register', { body: { name, email, password: PASSWORD }, ip });

const codeFromEmail = async (email, nth = 1) => {
  const msg = await sink.waitForEmail(email, nth);
  const code = sink.extractCode(msg);
  if (code) issuedCodes.add(code);
  return { msg, code };
};

const verify = (email, code, ip = freshIp()) =>
  api('POST', '/auth/verify-email', { body: { email, code }, ip });

const resend = (email, ip = freshIp()) =>
  api('POST', '/auth/resend-verification', { body: { email }, ip });

const login = (email, password = PASSWORD, ip = freshIp()) =>
  api('POST', '/auth/login', { body: { email, password }, ip });

const userRow = async (email) =>
  (
    await db(
      `SELECT id, email_verified, email_verified_at, is_active FROM users WHERE email = $1`,
      [email]
    )
  ).rows[0];

const codeRows = async (userId) =>
  (
    await db(
      `SELECT id, code_hash, attempts, max_attempts, used_at, invalidated_at, expires_at, created_at
       FROM email_verification_codes WHERE user_id = $1 ORDER BY created_at`,
      [userId]
    )
  ).rows;

const wrongCodeFor = (code) => String((parseInt(code, 10) + 1) % 1000000).padStart(6, '0');

const emailOf = (label) => `p15_${label}_${RUN_ID}@example.com`;

// ---------------------------------------------------------------------------
async function run() {
  console.log(`\n=== PHASE 15 EMAIL VERIFICATION TEST SUITE — run ${RUN_ID} ===\n`);

  sink = await startMailSink({ port: SMTP_PORT, user: SMTP_USER, pass: SMTP_PASS });
  let backend = startBackend();
  const up = await waitForHealth();
  check('0-Setup', 'backend starts with email configuration', up, backendLog.slice(-500));
  if (!up) throw new Error('backend did not start');

  // ======================================================================
  // 1. Valid registration sends email
  // ======================================================================
  const aEmail = emailOf('alice');
  let aCode;
  {
    const r = await register('Alice Verify', aEmail);
    check('01-Register', 'registration returns 201', r.status === 201, r.text);
    check('01-Register', 'response says verification required', r.json?.data?.verificationRequired === true);
    check('01-Register', 'response reports email sent', r.json?.data?.emailSent === true, r.text);
    check('01-Register', 'response email is masked', r.json?.data?.email === 'p********@example.com', r.json?.data?.email);
    check('01-Register', 'no access token issued at registration', !r.json?.data?.accessToken && !/accessToken/.test(r.text));
    check('01-Register', 'no refresh cookie set at registration', !(r.headers.get('set-cookie') || '').includes('refreshToken'));
    check('01-Register', 'no user id / role / hash in response', !/"id"|"role"|password|hash/i.test(r.text), r.text);

    const { msg, code } = await codeFromEmail(aEmail);
    aCode = code;
    check('01-Register', 'verification email delivered via authenticated SMTP', !!msg && msg.authUser === SMTP_USER);
    check('01-Register', 'subject is professional', msg?.subject === 'Verify your Corporate Event Management account', msg?.subject);
    check('01-Register', 'email contains a 6-digit code', /^\d{6}$/.test(code || ''));
    check('01-Register', 'email greets user by name', /Hello Alice Verify,/.test(msg?.text || ''));
    check('01-Register', 'email states 10-minute expiry', /expires in 10 minutes/.test(msg?.text || ''));
    check('01-Register', 'email has ignore-if-not-you notice', /did not create this account, you can safely ignore/.test(msg?.text || ''));
    check('01-Register', 'email has security notice', /never share this code/i.test(msg?.text || ''));
    check('01-Register', 'email has HTML version with the code', (msg?.html || '').includes(code));
    check('01-Register', 'email contains no password', !(msg?.text || '').includes(PASSWORD) && !(msg?.html || '').includes(PASSWORD));
    const u = await userRow(aEmail);
    check('01-Register', 'DB: new account is unverified employee', u && u.email_verified === false && u.email_verified_at === null);
    check('01-Register', 'DB: role is employee', (await db('SELECT role FROM users WHERE email=$1', [aEmail])).rows[0]?.role === 'employee');
    const rows = await codeRows(u.id);
    check('01-Register', 'DB: exactly one active code row', rows.length === 1 && !rows[0].used_at && !rows[0].invalidated_at);
    check('01-Register', 'DB: raw code not stored', rows[0].code_hash !== code && !rows[0].code_hash.includes(code));
    check(
      '01-Register',
      'DB: stored hash is not a plain SHA-256 of the code (keyed HMAC)',
      rows[0].code_hash !== crypto.createHash('sha256').update(code).digest('hex') && /^[0-9a-f]{64}$/.test(rows[0].code_hash)
    );
    const ttl = (new Date(rows[0].expires_at) - new Date(rows[0].created_at)) / 60000;
    check('01-Register', 'DB: code expires 10 minutes after issue', Math.abs(ttl - 10) < 0.01, String(ttl));
    check('01-Register', 'DB: max_attempts is 5', rows[0].max_attempts === 5);
  }

  // ======================================================================
  // 2. Invalid email rejected
  // ======================================================================
  {
    const r1 = await api('POST', '/auth/register', { body: { name: 'Bad', email: 'not-an-email', password: PASSWORD }, ip: freshIp() });
    check('02-InvalidEmail', 'register rejects invalid email (400)', r1.status === 400);
    const r2 = await verify('not-an-email', '123456');
    check('02-InvalidEmail', 'verify-email rejects invalid email (400)', r2.status === 400);
    const r3 = await resend('nope@');
    check('02-InvalidEmail', 'resend rejects invalid email (400)', r3.status === 400);
  }

  // ======================================================================
  // 12. Unverified login blocked (before verifying Alice)
  // ======================================================================
  {
    const r = await login(aEmail);
    check('12-UnverifiedLogin', 'unverified login returns 403', r.status === 403, r.text);
    check('12-UnverifiedLogin', 'controlled message', r.json?.error?.message === 'Please verify your email before signing in.');
    check('12-UnverifiedLogin', 'machine-readable code EMAIL_NOT_VERIFIED', r.json?.error?.code === 'EMAIL_NOT_VERIFIED');
    check('12-UnverifiedLogin', 'no access token issued', !/accessToken/.test(r.text));
    check('12-UnverifiedLogin', 'no refresh cookie issued', !(r.headers.get('set-cookie') || '').includes('refreshToken'));
    check('12-UnverifiedLogin', 'no role exposed', !/"role"/.test(r.text));
    const wrongPw = await login(aEmail, 'WrongPass999');
    check('12-UnverifiedLogin', 'wrong password on unverified account is still generic 401', wrongPw.status === 401 && wrongPw.json?.error?.message === 'Invalid email or password');
  }

  // ======================================================================
  // 3. Invalid code rejected / 7. attempt counter
  // ======================================================================
  {
    const u = await userRow(aEmail);
    const r = await verify(aEmail, wrongCodeFor(aCode));
    check('03-InvalidCode', 'wrong code returns 401', r.status === 401, r.text);
    check('03-InvalidCode', 'wrong code error code INVALID_CODE', r.json?.error?.code === 'INVALID_CODE');
    check('03-InvalidCode', 'account still unverified', (await userRow(aEmail)).email_verified === false);
    let rows = await codeRows(u.id);
    check('07-Attempts', 'DB: attempt counter incremented to 1', rows[0].attempts === 1, String(rows[0].attempts));
    check('07-Attempts', 'response does not reveal attempt counters', !/attempt/i.test(r.text.replace(/Too many incorrect attempts/g, '')) && !/remaining/i.test(r.text));
    await verify(aEmail, wrongCodeFor(wrongCodeFor(aCode)));
    rows = await codeRows(u.id);
    check('07-Attempts', 'DB: attempt counter incremented to 2', rows[0].attempts === 2);
    check('07-Attempts', 'code still active after 2 wrong attempts', !rows[0].invalidated_at);

    const unknown = await verify(emailOf('nobody'), '123456');
    check('03-InvalidCode', 'unknown email gets same 401 INVALID_CODE (no enumeration)', unknown.status === 401 && unknown.json?.error?.code === 'INVALID_CODE' && unknown.json?.error?.message === r.json?.error?.message);
  }

  // ======================================================================
  // 4. Valid code accepted
  // ======================================================================
  {
    const r = await verify(aEmail, aCode);
    check('04-ValidCode', 'correct code returns 200', r.status === 200, r.text);
    check('04-ValidCode', 'success message', r.json?.message === 'Email verified successfully. You can now sign in.');
    check('04-ValidCode', 'response has only safe fields', JSON.stringify(Object.keys(r.json?.data || {}).sort()) === '["email","emailVerified"]', r.text);
    const u = await userRow(aEmail);
    check('04-ValidCode', 'DB: email_verified = true', u.email_verified === true);
    check('04-ValidCode', 'DB: email_verified_at set', !!u.email_verified_at);
    const rows = await codeRows(u.id);
    check('04-ValidCode', 'DB: code marked used', !!rows[0].used_at);
    check('04-ValidCode', 'DB: no active code remains', rows.every((x) => x.used_at || x.invalidated_at));
  }

  // ======================================================================
  // 6. Reused code rejected
  // ======================================================================
  {
    const r = await verify(aEmail, aCode);
    check('06-Reuse', 'replaying used code on verified account rejected (409)', r.status === 409 && r.json?.error?.code === 'ALREADY_VERIFIED', r.text);
    // Stronger replay: even if the account were unverified again, the used
    // code must not work.
    await db('UPDATE users SET email_verified = false, email_verified_at = NULL WHERE email = $1', [aEmail]);
    const replay = await verify(aEmail, aCode);
    check('06-Reuse', 'used code cannot be replayed (401)', replay.status === 401 && replay.json?.error?.code === 'INVALID_CODE', replay.text);
    check('06-Reuse', 'account NOT verified by replay', (await userRow(aEmail)).email_verified === false);
    await db('UPDATE users SET email_verified = true, email_verified_at = now() WHERE email = $1', [aEmail]);
  }

  // ======================================================================
  // 13. Verified login succeeds (+ existing token architecture intact)
  // ======================================================================
  let aToken;
  let aRefreshCookie;
  {
    const r = await login(aEmail);
    aToken = r.json?.data?.accessToken;
    aRefreshCookie = (r.headers.get('set-cookie') || '').split(';')[0];
    check('13-VerifiedLogin', 'verified login returns 200', r.status === 200, r.text);
    check('13-VerifiedLogin', 'access token issued', !!aToken);
    check('13-VerifiedLogin', 'httpOnly refresh cookie issued', /refreshToken=.+HttpOnly/i.test(r.headers.get('set-cookie') || ''));
    check('13-VerifiedLogin', 'user.emailVerified true in payload', r.json?.data?.user?.emailVerified === true);
    const me = await api('GET', '/auth/me', { token: aToken });
    check('13-VerifiedLogin', '/auth/me works', me.status === 200 && me.json?.data?.user?.email === aEmail);
    const ref = await api('POST', '/auth/refresh-token', { cookie: aRefreshCookie });
    check('13-VerifiedLogin', 'refresh token works', ref.status === 200 && !!ref.json?.data?.accessToken);
    const out = await api('POST', '/auth/logout', { cookie: aRefreshCookie });
    check('13-VerifiedLogin', 'logout works', out.status === 200);
  }

  // ======================================================================
  // 17. Employee features still work for a verified employee
  // ======================================================================
  {
    const events = await api('GET', '/events', { token: aToken });
    check('17-EmployeeLogin', 'verified employee can list events', events.status === 200);
    const dash = await api('GET', '/employee/dashboard', { token: aToken });
    check('17-EmployeeLogin', 'verified employee dashboard works', dash.status === 200);
    const adminOnly = await api('GET', '/admin/dashboard', { token: aToken });
    check('17-EmployeeLogin', 'RBAC intact: employee blocked from admin dashboard (403)', adminOnly.status === 403);
  }

  // ======================================================================
  // 16. Admin login remains functional
  // ======================================================================
  let adminToken;
  {
    const r = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    adminToken = r.json?.data?.accessToken;
    check('16-AdminLogin', 'admin login returns 200', r.status === 200, r.text);
    check('16-AdminLogin', 'admin role preserved', r.json?.data?.user?.role === 'admin');
    const dash = await api('GET', '/admin/dashboard', { token: adminToken });
    check('16-AdminLogin', 'admin dashboard works', dash.status === 200);
  }

  // ======================================================================
  // 14. Duplicate registration blocked (sequential + concurrent)
  // ======================================================================
  {
    const r = await register('Alice Again', aEmail);
    check('14-Duplicate', 'duplicate (verified) email rejected 409', r.status === 409);
    const pendingEmail = emailOf('pendingdup');
    await register('Pending Dup', pendingEmail);
    const r2 = await register('Pending Dup 2', pendingEmail);
    check('14-Duplicate', 'duplicate (pending) email rejected 409', r2.status === 409);

    const raceEmail = emailOf('race');
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => register(`Racer ${i}`, raceEmail)));
    const created = results.filter((x) => x.status === 201).length;
    const conflicts = results.filter((x) => x.status === 409).length;
    check('14-Duplicate', 'concurrent duplicate registrations: exactly one 201', created === 1, results.map((x) => x.status).join(','));
    check('14-Duplicate', 'concurrent duplicate registrations: rest 409 (no 500)', conflicts === 5, results.map((x) => x.status).join(','));
    const count = (await db('SELECT COUNT(*)::int AS c FROM users WHERE email = $1', [raceEmail])).rows[0].c;
    check('14-Duplicate', 'DB: exactly one account for the email', count === 1);
  }

  // ======================================================================
  // 5. Expired code rejected
  // ======================================================================
  {
    const email = emailOf('expired');
    await register('Expired User', email);
    const { code } = await codeFromEmail(email);
    const u = await userRow(email);
    await db(`UPDATE email_verification_codes SET expires_at = now() - interval '1 second' WHERE user_id = $1`, [u.id]);
    const r = await verify(email, code);
    check('05-Expired', 'expired (correct) code rejected 401', r.status === 401, r.text);
    check('05-Expired', 'error code CODE_EXPIRED', r.json?.error?.code === 'CODE_EXPIRED');
    check('05-Expired', 'account stays unverified', (await userRow(email)).email_verified === false);
    const rows = await codeRows(u.id);
    check('05-Expired', 'DB: expired code invalidated', !!rows[0].invalidated_at);
    const again = await verify(email, code);
    check('05-Expired', 'expired code stays rejected', again.status === 401);
  }

  // ======================================================================
  // 8. Max attempts enforced
  // ======================================================================
  {
    const email = emailOf('maxattempts');
    await register('Max Attempts', email);
    const { code } = await codeFromEmail(email);
    const wrong = wrongCodeFor(code);
    const statuses = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await verify(email, wrong)).status);
    check('08-MaxAttempts', 'attempts 1-4 return 401', statuses.slice(0, 4).every((s) => s === 401), statuses.join(','));
    check('08-MaxAttempts', '5th wrong attempt returns 429', statuses[4] === 429, statuses.join(','));
    const u = await userRow(email);
    const rows = await codeRows(u.id);
    check('08-MaxAttempts', 'DB: code invalidated after 5 wrong attempts', !!rows[0].invalidated_at && rows[0].attempts === 5);
    const correct = await verify(email, code);
    check('08-MaxAttempts', 'correct code rejected after lockout (must request new)', correct.status === 401 && correct.json?.error?.code === 'INVALID_CODE');
    check('08-MaxAttempts', 'account stays unverified', (await userRow(email)).email_verified === false);
  }

  // ======================================================================
  // Concurrent wrong guesses cannot exceed the attempt limit
  // ======================================================================
  {
    const email = emailOf('parallelguess');
    await register('Parallel Guess', email);
    const { code } = await codeFromEmail(email);
    const guesses = Array.from({ length: 8 }, (_, i) => String((parseInt(code, 10) + i + 1) % 1000000).padStart(6, '0'));
    await Promise.all(guesses.map((g) => verify(email, g)));
    const u = await userRow(email);
    const rows = await codeRows(u.id);
    check('08-MaxAttempts', 'parallel guesses: attempts never exceed max (row lock)', rows[0].attempts === 5 && !!rows[0].invalidated_at, `attempts=${rows[0].attempts}`);
  }

  // ======================================================================
  // 10. Resend cooldown enforced
  // ======================================================================
  const rEmail = emailOf('resender');
  let rOldCode;
  {
    await register('Resend User', rEmail);
    rOldCode = (await codeFromEmail(rEmail)).code;
    const r = await resend(rEmail);
    check('10-Cooldown', 'immediate resend returns 429', r.status === 429, r.text);
    check('10-Cooldown', 'error code RESEND_COOLDOWN', r.json?.error?.code === 'RESEND_COOLDOWN');
    const retryAfter = parseInt(r.headers.get('retry-after'), 10);
    check('10-Cooldown', 'Retry-After header between 1 and 60', retryAfter >= 1 && retryAfter <= 60, String(retryAfter));
    check('10-Cooldown', 'retryAfterSeconds also in JSON body (CORS-safe for browsers)', r.json?.error?.retryAfterSeconds === retryAfter, r.text);
    await sleep(500);
    check('10-Cooldown', 'no extra email sent during cooldown', sink.messagesFor(rEmail).length === 1);
    const unknown = await resend(emailOf('ghost'));
    check('10-Cooldown', 'unknown email first resend: same generic 200', unknown.status === 200 && unknown.json?.message === 'If the account requires verification, a new code has been sent.');
    const unknown2 = await resend(emailOf('ghost'));
    check('10-Cooldown', 'unknown email second resend also 429 (uniform, no enumeration)', unknown2.status === 429 && unknown2.json?.error?.code === 'RESEND_COOLDOWN');
  }

  // ======================================================================
  // 15. Inactive account remains blocked
  // ======================================================================
  {
    await db('UPDATE users SET is_active = false WHERE email = $1', [aEmail]);
    const r = await login(aEmail);
    check('15-Inactive', 'deactivated verified account cannot log in (403)', r.status === 403 && /deactivated/.test(r.json?.error?.message || ''));
    const me = await api('GET', '/auth/me', { token: aToken });
    check('15-Inactive', 'deactivated account existing token rejected', me.status === 403);
    await db('UPDATE users SET is_active = true WHERE email = $1', [aEmail]);

    const email = emailOf('inactivepending');
    await register('Inactive Pending', email);
    const { code } = await codeFromEmail(email);
    await db('UPDATE users SET is_active = false WHERE email = $1', [email]);
    const v = await verify(email, code);
    check('15-Inactive', 'deactivated pending account cannot verify (generic 401)', v.status === 401 && v.json?.error?.code === 'INVALID_CODE');
    check('15-Inactive', 'deactivated pending account stays unverified', (await userRow(email)).email_verified === false);
    const l = await login(email);
    check('15-Inactive', 'deactivated pending account login blocked (403 deactivated)', l.status === 403 && /deactivated/.test(l.json?.error?.message || ''));
  }

  // ======================================================================
  // 11 (Existing accounts). Legacy employee created before Phase 15
  // ======================================================================
  const legacyEmail = 'legacy.employee@example.com';
  const legacyExists = !!(await userRow(legacyEmail));
  if (legacyExists) {
    const before = (await db(`SELECT name, password_hash, role, department, designation FROM users WHERE email = $1`, [legacyEmail])).rows[0];
    const regsBefore = (await db(`SELECT COUNT(*)::int c FROM registrations r JOIN users u ON u.id = r.user_id WHERE u.email = $1`, [legacyEmail])).rows[0].c;

    if ((await userRow(legacyEmail)).email_verified === false) {
      // A token minted the way Phase 2-14 minted them must no longer open protected APIs.
      const u = await userRow(legacyEmail);
      const oldToken = jwt.sign({ sub: u.id, role: 'employee' }, process.env.JWT_SECRET, { expiresIn: '15m' });
      const me = await api('GET', '/auth/me', { token: oldToken });
      check('11-Existing', 'pre-Phase-15 access token blocked while unverified (403)', me.status === 403 && me.json?.error?.code === 'EMAIL_NOT_VERIFIED', me.text);
      const oldRefresh = jwt.sign({ sub: u.id, role: 'employee' }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
      const ref = await api('POST', '/auth/refresh-token', { cookie: `refreshToken=${oldRefresh}` });
      check('11-Existing', 'pre-Phase-15 refresh token blocked while unverified (403)', ref.status === 403 && !/accessToken/.test(ref.text));

      const l1 = await login(legacyEmail, 'Legacy1234');
      check('11-Existing', 'existing employee login asks for verification (403)', l1.status === 403 && l1.json?.error?.code === 'EMAIL_NOT_VERIFIED', l1.text);
      const rs = await resend(legacyEmail);
      check('11-Existing', 'existing employee can request a code', rs.status === 200);
      const { code } = await codeFromEmail(legacyEmail, sink.messagesFor(legacyEmail).length + 1);
      check('11-Existing', 'existing employee receives code by email', /^\d{6}$/.test(code || ''));
      const v = await verify(legacyEmail, code);
      check('11-Existing', 'existing employee verifies', v.status === 200, v.text);
    }
    const l2 = await login(legacyEmail, 'Legacy1234');
    check('11-Existing', 'existing employee logs in with UNCHANGED password', l2.status === 200, l2.text);
    const after = (await db(`SELECT name, password_hash, role, department, designation FROM users WHERE email = $1`, [legacyEmail])).rows[0];
    check('11-Existing', 'name/password hash/role/department/designation preserved', JSON.stringify(before) === JSON.stringify(after));
    const myRegs = await api('GET', '/my-registrations', { token: l2.json?.data?.accessToken });
    check('11-Existing', 'existing event registrations still visible', myRegs.status === 200 && regsBefore >= 1 && myRegs.text.includes('Legacy Summit'), `${myRegs.status} regsBefore=${regsBefore}`);
  } else {
    console.log('  (legacy pre-Phase-15 employee not present in this DB — existing-account checks skipped)');
  }
  const adminRow = (await db(`SELECT email_verified FROM users WHERE email = $1`, [ADMIN_EMAIL])).rows[0];
  check('11-Existing', 'seed admin is marked verified', adminRow?.email_verified === true);

  // ======================================================================
  // 21. Malformed code rejected
  // ======================================================================
  {
    const email = emailOf('malformed');
    const cases = [
      ['5 digits', '12345'],
      ['7 digits', '1234567'],
      ['letters', 'abcdef'],
      ['number type', 123456],
      ['space inside', '123 56'],
      ['null', null],
      ['array', ['123456']],
      ['object', { $gt: '' }],
      ['empty', ''],
      ['unicode digits', '١٢٣٤٥٦'],
    ];
    for (const [label, code] of cases) {
      const r = await api('POST', '/auth/verify-email', { body: { email, code }, ip: freshIp() });
      check('21-Malformed', `malformed code (${label}) rejected 400`, r.status === 400, `${r.status} ${r.text.slice(0, 120)}`);
    }
    const missing = await api('POST', '/auth/verify-email', { body: { email }, ip: freshIp() });
    check('21-Malformed', 'missing code rejected 400', missing.status === 400);
    const badJson = await api('POST', '/auth/verify-email', { rawBody: '{"email": "x@y.com", "code": ', ip: freshIp() });
    check('21-Malformed', 'malformed JSON rejected 400 with safe message', badJson.status === 400 && badJson.json?.error?.message === 'Malformed JSON request body', badJson.text.slice(0, 150));
  }

  // ======================================================================
  // 22. Unexpected JSON fields handled safely
  // ======================================================================
  {
    const email = emailOf('extrafields');
    await register('Extra Fields', email);
    const { code } = await codeFromEmail(email);
    const r1 = await api('POST', '/auth/verify-email', { body: { email, code, emailVerified: true, role: 'admin' }, ip: freshIp() });
    check('22-UnexpectedFields', 'extra fields on verify-email rejected 400', r1.status === 400, r1.text.slice(0, 150));
    check('22-UnexpectedFields', 'extra fields did not verify the account', (await userRow(email)).email_verified === false);
    const r2 = await api('POST', '/auth/resend-verification', { body: { email, userId: 'x' }, ip: freshIp() });
    check('22-UnexpectedFields', 'extra fields on resend rejected 400', r2.status === 400);
    const r3 = await api('POST', '/auth/verify-email', { body: { email: { $ne: null }, code }, ip: freshIp() });
    check('22-UnexpectedFields', 'operator-object email rejected 400', r3.status === 400);
    const r4 = await api('POST', '/auth/verify-email', { rawBody: `{"email":"${email}","code":"${code}","__proto__":{"admin":true}}`, ip: freshIp() });
    check('22-UnexpectedFields', '__proto__ payload rejected 400', r4.status === 400, r4.text.slice(0, 150));
    const r5 = await api('POST', '/auth/verify-email', { rawBody: '["not","an","object"]', ip: freshIp() });
    check('22-UnexpectedFields', 'array body rejected 400', r5.status === 400);
    const sqli = await verify(`x'; DROP TABLE users; --@example.com`, '123456');
    check('22-UnexpectedFields', 'SQL-injection-shaped email rejected safely', sqli.status === 400 || sqli.status === 401);
    check('22-UnexpectedFields', 'users table intact', (await db('SELECT COUNT(*)::int c FROM users')).rows[0].c > 0);
    const ok = await verify(email, code);
    check('22-UnexpectedFields', 'valid request still verifies afterwards', ok.status === 200);
  }

  // ======================================================================
  // 23. Oversized request rejected
  // ======================================================================
  {
    const big = await api('POST', '/auth/verify-email', { body: { email: `${'a'.repeat(5000)}@example.com`, code: '123456' }, ip: freshIp() });
    check('23-Oversized', '5 KB verify body rejected 413', big.status === 413 && big.json?.error?.message === 'Request payload too large', `${big.status}`);
    const bigResend = await api('POST', '/auth/resend-verification', { body: { email: `${'a'.repeat(5000)}@example.com` }, ip: freshIp() });
    check('23-Oversized', '5 KB resend body rejected 413', bigResend.status === 413);
    const huge = await api('POST', '/auth/verify-email', { rawBody: JSON.stringify({ email: 'x@y.com', code: '1'.repeat(300 * 1024) }), ip: freshIp() });
    check('23-Oversized', '300 KB body rejected 413 by global parser with safe message', huge.status === 413 && huge.json?.error?.message === 'Request payload too large', `${huge.status} ${huge.text.slice(0, 100)}`);
    const longEmail = await verify(`${'a'.repeat(250)}@example.com`, '123456');
    check('23-Oversized', 'over-length (but small) email rejected 400', longEmail.status === 400);
    const health = await api('GET', '/health');
    check('23-Oversized', 'server healthy after oversized requests', health.status === 200);
  }

  // ======================================================================
  // 24. Verification rate limits
  // ======================================================================
  {
    const ip = freshIp();
    const statuses = [];
    for (let i = 0; i < 21; i += 1) statuses.push((await verify(emailOf(`rl${i}`), '000000', ip)).status);
    check('24-VerifyRateLimit', 'per-IP: first 20 requests not rate limited', statuses.slice(0, 20).every((s) => s !== 429), statuses.join(','));
    check('24-VerifyRateLimit', 'per-IP: 21st request returns 429', statuses[20] === 429, statuses.join(','));

    const email = emailOf('rlemail');
    const perEmail = [];
    for (let i = 0; i < 11; i += 1) perEmail.push(await verify(email, '000000', freshIp()));
    check('24-VerifyRateLimit', 'per-email: first 10 not rate limited', perEmail.slice(0, 10).every((r) => r.status !== 429), perEmail.map((r) => r.status).join(','));
    check('24-VerifyRateLimit', 'per-email: 11th (from a new IP) returns 429', perEmail[10].status === 429 && perEmail[10].json?.error?.code === 'RATE_LIMITED');
  }

  // ======================================================================
  // 25. Resend rate limits
  // ======================================================================
  {
    const ip = freshIp();
    const statuses = [];
    for (let i = 0; i < 11; i += 1) statuses.push((await resend(emailOf(`rsl${i}`), ip)).status);
    check('25-ResendRateLimit', 'per-IP: first 10 not rate limited', statuses.slice(0, 10).every((s) => s === 200), statuses.join(','));
    check('25-ResendRateLimit', 'per-IP: 11th returns 429', statuses[10] === 429, statuses.join(','));

    const email = emailOf('rslemail');
    const perEmail = [];
    for (let i = 0; i < 6; i += 1) perEmail.push(await resend(email, freshIp()));
    check('25-ResendRateLimit', 'per-email: requests 2-5 hit cooldown', perEmail.slice(1, 5).every((r) => r.json?.error?.code === 'RESEND_COOLDOWN'), perEmail.map((r) => r.json?.error?.code || r.status).join(','));
    check('25-ResendRateLimit', 'per-email: 6th within the hour hits RATE_LIMITED', perEmail[5].status === 429 && perEmail[5].json?.error?.code === 'RATE_LIMITED');
  }

  // ======================================================================
  // 18b. Email delivery failure (Phase 15 §18)
  // ======================================================================
  const failEmail = emailOf('mailfail');
  {
    await sink.close();
    const r = await register('Mail Fail', failEmail);
    check('18b-DeliveryFailure', 'registration still 201 when email cannot be sent', r.status === 201, r.text);
    check('18b-DeliveryFailure', 'response reports emailSent=false', r.json?.data?.emailSent === false);
    check('18b-DeliveryFailure', 'response tells user to request a new code', /request a new code/.test(r.json?.message || ''));
    const u = await userRow(failEmail);
    check('18b-DeliveryFailure', 'pending account kept (no duplicate possible)', !!u && u.email_verified === false);
    check('18b-DeliveryFailure', 'undelivered code row removed', (await codeRows(u.id)).length === 0);
    const dup = await register('Mail Fail 2', failEmail);
    check('18b-DeliveryFailure', 're-register same email still 409', dup.status === 409);
    sink = await startMailSink({ port: SMTP_PORT, user: SMTP_USER, pass: SMTP_PASS });
    const rs = await resend(failEmail);
    check('18b-DeliveryFailure', 'resend allowed immediately after failed delivery', rs.status === 200, rs.text);
    const { code } = await codeFromEmail(failEmail);
    const v = await verify(failEmail, code);
    check('18b-DeliveryFailure', 'account verifies once delivery recovers', v.status === 200);
    check('18b-DeliveryFailure', 'failure log line contains masked email only', backendLog.includes('delivery failed for p********@example.com') && !backendLog.includes(failEmail));
  }

  // ======================================================================
  // 9 + 11. Resend works / old code invalid after resend (real 60s wait)
  // ======================================================================
  {
    console.log('  ... waiting 61s for the real resend cooldown to elapse');
    await sleep(61000);
    const r = await resend(rEmail);
    check('09-Resend', 'resend after cooldown returns 200 generic', r.status === 200 && r.json?.message === 'If the account requires verification, a new code has been sent.', r.text);
    const { code: newCode } = await codeFromEmail(rEmail, 1);
    check('09-Resend', 'new code emailed', /^\d{6}$/.test(newCode || ''));
    const u = await userRow(rEmail);
    const rows = await codeRows(u.id);
    check('09-Resend', 'DB: old code invalidated, one active new code', rows.length === 2 && !!rows[0].invalidated_at && !rows[1].invalidated_at && !rows[1].used_at);
    if (newCode !== rOldCode) {
      const old = await verify(rEmail, rOldCode);
      check('11-OldCodeInvalid', 'old code rejected after resend (401)', old.status === 401 && old.json?.error?.code === 'INVALID_CODE', old.text);
    } else {
      check('11-OldCodeInvalid', 'old code rejected after resend (codes coincided 1-in-a-million; row check)', !!rows[0].invalidated_at);
    }
    const ok = await verify(rEmail, newCode);
    check('09-Resend', 'new code verifies the account', ok.status === 200, ok.text);
    const verifiedResend = await resend(aEmail);
    await sleep(300);
    check('09-Resend', 'resend for already-verified account: generic 200, no email', verifiedResend.status === 200 && sink.messagesFor(aEmail).length === 0);
  }

  // ======================================================================
  // Cleanup strategy
  // ======================================================================
  {
    const u = await userRow(rEmail);
    await db(`UPDATE email_verification_codes SET created_at = now() - interval '25 hours' WHERE user_id = $1`, [u.id]);
    const out = spawnSync(process.execPath, ['src/scripts/cleanupVerificationCodes.js'], { cwd: BACKEND_DIR, encoding: 'utf8' });
    check('Cleanup', 'cleanup script runs', out.status === 0, out.stderr);
    check('Cleanup', 'stale rows removed', (await codeRows(u.id)).length === 0 && /Removed [1-9]\d* stale/.test(out.stdout), out.stdout);
  }

  // ======================================================================
  // Brevo HTTPS API provider (for Render free tier) — real HTTP request
  // to a local stand-in for the Brevo endpoint.
  // ======================================================================
  {
    let received = null;
    const mock = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => {
        body += c;
      });
      req.on('end', () => {
        received = { headers: req.headers, body: JSON.parse(body) };
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end('{"messageId":"x"}');
      });
    });
    await new Promise((r) => mock.listen(0, '127.0.0.1', r));
    const BREVO_KEYS = ['EMAIL_PROVIDER', 'EMAIL_API_KEY', 'EMAIL_FROM', 'BREVO_API_URL'];
    const saved = Object.fromEntries(BREVO_KEYS.map((k) => [k, process.env[k]]));
    Object.assign(process.env, {
      EMAIL_PROVIDER: 'brevo',
      EMAIL_API_KEY: 'test-brevo-key',
      EMAIL_FROM: 'Corporate Event Management <no-reply@corporate-event.test>',
      BREVO_API_URL: `http://127.0.0.1:${mock.address().port}/v3/smtp/email`,
    });
    const emailService = require('../src/services/email.service');
    let err = null;
    try {
      await emailService.sendVerificationEmail({ to: 'brevo@example.com', name: 'Brevo User', code: '424242', expiresInMinutes: 10 });
    } catch (e) {
      err = e;
    }
    check('Provider-Brevo', 'Brevo provider sends successfully', !err, err && err.message);
    check('Provider-Brevo', 'api-key header sent', received?.headers['api-key'] === 'test-brevo-key');
    check('Provider-Brevo', 'sender parsed from EMAIL_FROM', received?.body?.sender?.email === 'no-reply@corporate-event.test' && received?.body?.sender?.name === 'Corporate Event Management');
    check('Provider-Brevo', 'recipient, subject, text+html content present', received?.body?.to?.[0]?.email === 'brevo@example.com' && /Verify your/.test(received?.body?.subject) && received?.body?.textContent.includes('424242') && received?.body?.htmlContent.includes('424242'));
    // Failure path: provider error surfaces as a sanitized error.
    process.env.EMAIL_API_KEY = 'x';
    process.env.BREVO_API_URL = 'http://127.0.0.1:1/v3/smtp/email';
    let failErr = null;
    try {
      await emailService.sendEmail({ to: 'a@b.com', subject: 's', text: 't', html: 'h' });
    } catch (e) {
      failErr = e;
    }
    check('Provider-Brevo', 'unreachable provider → sanitized error (no key in message)', !!failErr && !failErr.message.includes('x@') && /Email delivery failed \(brevo\)/.test(failErr.message));
    BREVO_KEYS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
    mock.close();
  }

  // ======================================================================
  // Production fail-fast when email isn't configured
  // ======================================================================
  {
    const env = { ...process.env, NODE_ENV: 'production', PORT: String(API_PORT + 1) };
    // Blank rather than delete: the child's dotenv would otherwise refill
    // these from a populated backend/.env (dotenv never overrides set keys).
    ['EMAIL_PROVIDER', 'EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_FROM', 'EMAIL_API_KEY', 'EMAIL_USER', 'EMAIL_PASSWORD'].forEach((k) => {
      env[k] = '';
    });
    const out = spawnSync(process.execPath, ['server.js'], { cwd: BACKEND_DIR, env, encoding: 'utf8', timeout: 15000 });
    check('Config', 'production refuses to start without email config', out.status === 1 && /email delivery is not configured/.test(out.stderr), `${out.status} ${out.stderr.slice(0, 200)}`);
  }

  // ======================================================================
  // 18/19/20. Secrecy scans (run last, over everything above)
  // ======================================================================
  await sleep(300);
  const allEmails = sink.messages.length; // after restart; codes captured all along in issuedCodes
  const codes = [...issuedCodes];
  check('18-NoCodeInResponses', `captured ${codes.length} real codes to scan for`, codes.length >= 8, String(codes.length));
  {
    const leaked = codes.filter((c) => allResponseBodies.some((b) => new RegExp(`(^|\\D)${c}(\\D|$)`).test(b)));
    check('18-NoCodeInResponses', `no issued code appears in any of ${allResponseBodies.length} API responses`, leaked.length === 0, leaked.join(','));
  }
  {
    const leaked = codes.filter((c) => new RegExp(`(^|\\D)${c}(\\D|$)`).test(backendLog));
    check('19-NoCodeInLogs', `no issued code appears in backend logs (${backendLog.length} chars)`, leaked.length === 0, leaked.join(','));
    check('19-NoCodeInLogs', 'SMTP password never appears in backend logs', !backendLog.includes(SMTP_PASS));
    check('19-NoCodeInLogs', 'SMTP password never appears in API responses', !allResponseBodies.some((b) => b.includes(SMTP_PASS)));
    const hashes = (await db('SELECT code_hash FROM email_verification_codes')).rows.map((r) => r.code_hash);
    check('19-NoCodeInLogs', 'no code hash appears in logs or responses', !hashes.some((h) => backendLog.includes(h) || allResponseBodies.some((b) => b.includes(h))));
  }
  {
    const distDir = path.join(FRONTEND_DIR, 'dist');
    const files = [];
    const walk = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else files.push(p);
      }
    };
    walk(distDir);
    walk(path.join(FRONTEND_DIR, 'src'));
    const contents = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    check('20-NoSecretsInFrontend', `frontend build exists (${files.length} files scanned)`, fs.existsSync(path.join(distDir, 'index.html')));
    check('20-NoSecretsInFrontend', 'no EMAIL_* / SMTP variable names in frontend', !/EMAIL_(HOST|PORT|USER|PASSWORD|API_KEY|FROM|SECURE)|SMTP_|nodemailer/i.test(contents));
    check('20-NoSecretsInFrontend', 'SMTP password value not in frontend', !contents.includes(SMTP_PASS));
    const feEnv = fs.readFileSync(path.join(FRONTEND_DIR, '.env.example'), 'utf8');
    check('20-NoSecretsInFrontend', 'frontend .env.example has no email settings', !/EMAIL|SMTP/i.test(feEnv));
  }

  backend.kill('SIGTERM');
  await new Promise((r) => backend.once('exit', r));
  backend = null;
  await sink.close();

  // ======================================================================
  console.log('\n=== RESULTS BY SECTION ===');
  Object.entries(sections).forEach(([s, r]) => console.log(`  ${s.padEnd(26)} pass ${r.pass}  fail ${r.fail}`));
  console.log(`\nTOTAL: ${passCount} passed, ${failCount} failed (emails captured after sink restart: ${allEmails})`);
  if (failures.length) {
    console.log('\nFAILURES:');
    failures.forEach((f) => console.log(`  [${f.section}] ${f.name} — ${f.details}`));
  }
  await pool.end();
  process.exit(failCount > 0 ? 1 : 0);
}

run().catch(async (err) => {
  console.error('Suite crashed:', err);
  console.error('--- backend log tail ---\n', backendLog.slice(-2000));
  process.exit(2);
});
