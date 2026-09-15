/**
 * PostgreSQL connection pool.
 *
 * We use a "pool" instead of a single client because a pool automatically
 * manages multiple simultaneous connections and reuses them, which is what
 * a real backend needs when many requests hit the API at the same time.
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // max number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Log a clear message the first time we successfully connect.
pool.on('connect', () => {
  console.log('PostgreSQL pool: new client connected');
});

// If a connection in the pool errors out unexpectedly, log it instead of
// crashing the whole process.
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

/**
 * Helper used by future models/services to run queries without every file
 * needing to import `pg` directly.
 */
const query = (text, params) => pool.query(text, params);

/**
 * Runs `callback` inside a single PostgreSQL transaction on ONE dedicated
 * connection (checked out from the pool for the duration of the callback).
 *
 * This is essential for anything that needs to read-then-write atomically
 * across multiple statements — e.g. "lock this event row, check capacity,
 * pick a seat, insert a registration" all needs to happen as one atomic
 * unit so two simultaneous requests can never both succeed in taking the
 * last seat. The plain `query()` helper above can't do this: every call to
 * `pool.query()` may run on a different pooled connection, and each one is
 * implicitly its own transaction — there's no way to hold a row lock
 * across several `query()` calls.
 *
 * On success, commits and returns whatever `callback` returned. On any
 * thrown error, rolls back and re-throws, so the caller's normal
 * try/catch / ApiError handling still works unchanged.
 */
const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Simple connectivity check used by the health-check endpoint.
 * Returns true/false instead of throwing, so the health route can report
 * "database not reachable" instead of crashing.
 */
const checkConnection = async () => {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    console.error('Database connectivity check failed:', err.message);
    return false;
  }
};

module.exports = {
  pool,
  query,
  withTransaction,
  checkConnection,
};
