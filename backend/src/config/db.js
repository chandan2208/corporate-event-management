/**
 * PostgreSQL connection pool.
 *
 * We use a "pool" instead of a single client because a pool automatically
 * manages multiple simultaneous connections and reuses them, which is what
 * a real backend needs when many requests hit the API at the same time.
 */

const { Pool } = require('pg');

/**
 * Builds the connection settings from the environment.
 *
 * DATABASE_URL (a single connection string, exactly what Render, Supabase
 * and Neon all hand you) is preferred — it's the same variable
 * node-pg-migrate already uses, so the app and its migrations can no
 * longer silently point at two different databases. SSL is controlled by
 * the URL's own `sslmode` parameter:
 *   - Render *internal* URL (same region):     no sslmode needed
 *   - Render *external* URL / Neon:            ?sslmode=require
 *   - Supabase (its own CA, not in Node's trust store), Session pooler:
 *       ?sslmode=verify-full&sslrootcert=certs/supabase-prod-ca-2021.crt
 *     (path is relative to backend/, the working directory on Render; the
 *     file is Supabase's PUBLIC root CA, safe to commit)
 *
 * The discrete DB_HOST/DB_PORT/... variables are still supported as a
 * fallback so existing local .env files keep working unchanged; DB_SSL=true
 * enables (non-verifying) SSL for that mode.
 *
 * Exported so scripts that need their own Pool (e.g. the Phase 13 test
 * suite) connect exactly the same way the app does.
 */
const buildConnectionConfig = () => {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
    return { connectionString: process.env.DATABASE_URL.trim() };
  }

  return {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ...(process.env.DB_SSL === 'true' && { ssl: { rejectUnauthorized: false } }),
  };
};

const pool = new Pool({
  ...buildConnectionConfig(),
  max: parseInt(process.env.DB_POOL_MAX, 10) || 10, // free-tier Postgres plans cap total connections
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
  buildConnectionConfig,
  pool,
  query,
  withTransaction,
  checkConnection,
};
