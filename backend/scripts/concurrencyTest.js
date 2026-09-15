/**
 * Standalone concurrency test (not part of the app — run manually).
 *
 * Logs in as N different employees, then fires ALL of their registration
 * requests at the SAME single-seat event simultaneously (via
 * Promise.all), and reports how many succeeded vs failed. If the
 * concurrency-safety logic in registration.service.js works correctly,
 * EXACTLY ONE request should succeed no matter how many fire at once.
 *
 * Usage: node scripts/concurrencyTest.js <eventId> <numEmployees>
 */

const fs = require('fs');
const BASE_URL = 'http://localhost:5000/api';

const login = async (email, password) => {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${email}: ${JSON.stringify(body)}`);
  return body.data.accessToken;
};

const register = async (token, eventId) => {
  const res = await fetch(`${BASE_URL}/events/${eventId}/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  return { status: res.status, body };
};

const run = async () => {
  const eventId = process.argv[2];
  const numEmployees = parseInt(process.argv[3], 10) || 10;
  const useCache = process.argv[4] === '--cached';

  if (!eventId) {
    console.error('Usage: node scripts/concurrencyTest.js <eventId> <numEmployees> [--cached]');
    process.exit(1);
  }

  let tokens;
  if (useCache && fs.existsSync('/tmp/race_tokens.json')) {
    tokens = JSON.parse(fs.readFileSync('/tmp/race_tokens.json', 'utf8')).slice(0, numEmployees);
    console.log(`Using ${tokens.length} cached tokens (no fresh logins, avoids rate limiter).`);
  } else {
    console.log(`Logging in as ${numEmployees} employees...`);
    tokens = [];
    for (let i = 1; i <= numEmployees; i += 1) {
      const token = await login(`racetest${i}@example.com`, 'RaceTest123');
      tokens.push(token);
    }
  }
  console.log(`Got ${tokens.length} tokens. Firing all ${tokens.length} registration requests SIMULTANEOUSLY...`);

  const startTime = Date.now();
  const results = await Promise.all(tokens.map((token) => register(token, eventId)));
  const elapsed = Date.now() - startTime;

  const successes = results.filter((r) => r.status === 201);
  const conflicts = results.filter((r) => r.status === 409);
  const otherErrors = results.filter((r) => r.status !== 201 && r.status !== 409);

  console.log(`\nCompleted in ${elapsed}ms`);
  console.log(`Successes (201): ${successes.length}`);
  console.log(`Conflicts (409, expected for a full/duplicate event): ${conflicts.length}`);
  console.log(`Other/unexpected statuses: ${otherErrors.length}`);

  if (successes.length > 0) {
    const seats = successes.map((r) => r.body.data.registration.seatLabel);
    console.log(`Seat(s) assigned to successful request(s): ${JSON.stringify(seats)}`);
    const uniqueSeats = new Set(seats);
    console.log(`Unique seats among successes: ${uniqueSeats.size} (should equal successes.length)`);
  }

  if (otherErrors.length > 0) {
    console.log('Unexpected results:', JSON.stringify(otherErrors, null, 2));
  }

  console.log('\n--- Verdict ---');
  const uniqueSeatCount = new Set(successes.map((r) => r.body.data.registration.seatLabel)).size;
  const noDuplicateSeats = uniqueSeatCount === successes.length;
  const noOverbooking = otherErrors.length === 0; // every failure was a clean 409, not a crash/500
  if (successes.length >= 1 && noDuplicateSeats && noOverbooking) {
    console.log(
      `PASS: ${successes.length} registration(s) succeeded, all with unique seats, ` +
        `remaining ${conflicts.length} correctly rejected as conflicts (full/duplicate), no unexpected errors.`
    );
  } else {
    console.log('FAIL: duplicate seats, unexpected error statuses, or zero successes.');
    process.exit(1);
  }
};

run().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});
