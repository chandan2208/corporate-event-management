/**
 * Standalone concurrency test (not part of the app — run manually).
 *
 * Fires MANY simultaneous certificate-generation requests for the SAME
 * eligible registration. If the idempotent get-or-create strategy in
 * certificate.service.js works correctly, ALL requests should succeed
 * (200) — that's the point of idempotency, unlike registration/check-in
 * where only one should win — but they must all return the SAME
 * certificate id/number, and the database must end up with exactly one
 * row for that registration.
 *
 * Usage: node scripts/certificateConcurrencyTest.js <email> <password> <registrationId> <numRequests>
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

const getCertificate = async (token, registrationId) => {
  const res = await fetch(`${BASE_URL}/registrations/${registrationId}/certificate`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  return { status: res.status, body };
};

const run = async () => {
  const [, , email, password, registrationId, numRequestsArg] = process.argv;
  const numRequests = parseInt(numRequestsArg, 10) || 10;

  if (!email || !password || !registrationId) {
    console.error(
      'Usage: node scripts/certificateConcurrencyTest.js <email> <password> <registrationId> <numRequests>'
    );
    process.exit(1);
  }

  console.log('Logging in...');
  const token = await login(email, password);

  console.log(`Firing ${numRequests} simultaneous certificate requests for the SAME registration...`);
  const startTime = Date.now();
  const results = await Promise.all(
    Array.from({ length: numRequests }, () => getCertificate(token, registrationId))
  );
  const elapsed = Date.now() - startTime;

  const successes = results.filter((r) => r.status === 200);
  const otherErrors = results.filter((r) => r.status !== 200);

  console.log(`\nCompleted in ${elapsed}ms`);
  console.log(`Successes (200): ${successes.length}`);
  console.log(`Other/unexpected statuses: ${otherErrors.length}`);

  const certIds = new Set(successes.map((r) => r.body.data.certificate.id));
  const certNumbers = new Set(successes.map((r) => r.body.data.certificate.certificateNumber));

  console.log(`Unique certificate IDs among successes: ${certIds.size} (should be 1)`);
  console.log(`Unique certificate numbers among successes: ${certNumbers.size} (should be 1)`);

  if (otherErrors.length > 0) {
    console.log('Unexpected results:', JSON.stringify(otherErrors, null, 2));
  }

  console.log('\n--- Verdict ---');
  if (successes.length === numRequests && certIds.size === 1 && certNumbers.size === 1) {
    console.log('PASS: all concurrent requests succeeded and converged to the SAME single certificate.');
  } else {
    console.log('FAIL: expected all requests to succeed with exactly one unique certificate.');
    process.exit(1);
  }
};

run().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});
