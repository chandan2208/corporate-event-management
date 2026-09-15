/**
 * Standalone concurrency test (not part of the app — run manually).
 *
 * Fires MANY simultaneous check-in requests against the SAME QR token
 * (simulating two or more scanner devices scanning the same badge at
 * almost the same instant). If the row-locking strategy in
 * registration.service.js's checkInByToken works correctly, EXACTLY ONE
 * request should succeed (200) no matter how many fire at once — every
 * other one should get a clean 409.
 *
 * Usage: node scripts/checkinConcurrencyTest.js <adminEmail> <adminPassword> <token> <numRequests>
 */

const BASE_URL = 'http://localhost:5000/api';

const login = async (email, password) => {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${JSON.stringify(body)}`);
  return body.data.accessToken;
};

const checkIn = async (token, qrToken) => {
  const res = await fetch(`${BASE_URL}/registrations/check-in`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: qrToken }),
  });
  const body = await res.json();
  return { status: res.status, body };
};

const run = async () => {
  const [, , adminEmail, adminPassword, qrToken, numRequestsArg] = process.argv;
  const numRequests = parseInt(numRequestsArg, 10) || 10;

  if (!adminEmail || !adminPassword || !qrToken) {
    console.error(
      'Usage: node scripts/checkinConcurrencyTest.js <adminEmail> <adminPassword> <token> <numRequests>'
    );
    process.exit(1);
  }

  console.log('Logging in as admin...');
  const adminToken = await login(adminEmail, adminPassword);

  console.log(`Firing ${numRequests} simultaneous check-in requests against the SAME token...`);
  const startTime = Date.now();
  const results = await Promise.all(
    Array.from({ length: numRequests }, () => checkIn(adminToken, qrToken))
  );
  const elapsed = Date.now() - startTime;

  const successes = results.filter((r) => r.status === 200);
  const conflicts = results.filter((r) => r.status === 409);
  const otherErrors = results.filter((r) => r.status !== 200 && r.status !== 409);

  console.log(`\nCompleted in ${elapsed}ms`);
  console.log(`Successes (200): ${successes.length}`);
  console.log(`Conflicts (409, expected for a token already checked in by another request): ${conflicts.length}`);
  console.log(`Other/unexpected statuses: ${otherErrors.length}`);

  if (otherErrors.length > 0) {
    console.log('Unexpected results:', JSON.stringify(otherErrors, null, 2));
  }

  console.log('\n--- Verdict ---');
  if (successes.length === 1 && otherErrors.length === 0) {
    console.log('PASS: exactly one check-in succeeded, all others correctly rejected as conflicts.');
  } else {
    console.log(`FAIL: expected exactly 1 success and 0 unexpected errors, got ${successes.length} successes.`);
    process.exit(1);
  }
};

run().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});
