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

const run = async () => {
  const numEmployees = parseInt(process.argv[2], 10) || 10;
  const tokens = [];
  for (let i = 1; i <= numEmployees; i += 1) {
    const token = await login(`racetest${i}@example.com`, 'RaceTest123');
    tokens.push(token);
  }
  fs.writeFileSync('/tmp/race_tokens.json', JSON.stringify(tokens));
  console.log(`Cached ${tokens.length} tokens to /tmp/race_tokens.json`);
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
