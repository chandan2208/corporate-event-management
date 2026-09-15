/**
 * Standalone concurrency test (not part of the app — run manually).
 *
 * Fires MANY simultaneous feedback submissions from the SAME employee for
 * the SAME event. If the unique-constraint + error-code-catching strategy
 * in feedback.service.js works correctly, EXACTLY ONE request should
 * succeed (201) no matter how many fire at once — every other one should
 * get a clean 409, and the database should end up with exactly one row.
 *
 * Usage: node scripts/feedbackConcurrencyTest.js <email> <password> <eventId> <numRequests>
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

const submitFeedback = async (token, eventId, rating) => {
  const res = await fetch(`${BASE_URL}/events/${eventId}/feedback`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, comment: `Concurrent attempt with rating ${rating}` }),
  });
  const body = await res.json();
  return { status: res.status, body };
};

const run = async () => {
  const [, , email, password, eventId, numRequestsArg] = process.argv;
  const numRequests = parseInt(numRequestsArg, 10) || 10;

  if (!email || !password || !eventId) {
    console.error(
      'Usage: node scripts/feedbackConcurrencyTest.js <email> <password> <eventId> <numRequests>'
    );
    process.exit(1);
  }

  console.log('Logging in...');
  const token = await login(email, password);

  console.log(`Firing ${numRequests} simultaneous feedback submissions from the SAME employee...`);
  const startTime = Date.now();
  const results = await Promise.all(
    Array.from({ length: numRequests }, (_, i) => submitFeedback(token, eventId, (i % 5) + 1))
  );
  const elapsed = Date.now() - startTime;

  const successes = results.filter((r) => r.status === 201);
  const conflicts = results.filter((r) => r.status === 409);
  const otherErrors = results.filter((r) => r.status !== 201 && r.status !== 409);

  console.log(`\nCompleted in ${elapsed}ms`);
  console.log(`Successes (201): ${successes.length}`);
  console.log(`Conflicts (409): ${conflicts.length}`);
  console.log(`Other/unexpected statuses: ${otherErrors.length}`);

  if (otherErrors.length > 0) {
    console.log('Unexpected results:', JSON.stringify(otherErrors, null, 2));
  }

  console.log('\n--- Verdict ---');
  if (successes.length === 1 && otherErrors.length === 0) {
    console.log('PASS: exactly one feedback submission succeeded, all others correctly rejected as conflicts.');
  } else {
    console.log(`FAIL: expected exactly 1 success and 0 unexpected errors, got ${successes.length} successes.`);
    process.exit(1);
  }
};

run().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});
