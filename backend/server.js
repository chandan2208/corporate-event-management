/**
 * Entry point of the backend. Responsible only for:
 * 1. Loading environment variables
 * 2. Validating required configuration (fail fast if incomplete — Phase 14)
 * 3. Starting the HTTP server
 * 4. Handling process-level crashes gracefully
 * 5. Handling graceful shutdown on SIGTERM/SIGINT (Phase 14)
 *
 * All actual app configuration lives in src/app.js.
 */

// Pin the process timezone to UTC before anything touches a Date. `pg`
// parses DATE columns (events.event_date) as LOCAL midnight, and the event
// service turns that back into YYYY-MM-DD via toISOString() — on a machine
// east of UTC (e.g. IST, +05:30) that shifts every event date back one
// day, so valid updates failed "deadline must be before event start".
// Render already runs in UTC; this makes every environment behave the same.
process.env.TZ = 'UTC';

require('dotenv').config();

const validateEnv = require('./src/config/validateEnv');
validateEnv();

const app = require('./src/app');
const { pool } = require('./src/config/db');
const { cleanupStaleCodes } = require('./src/services/emailVerification.service');

const PORT = process.env.PORT || 5000;
// Optional bind address, e.g. HOST=127.0.0.1 for local development. Unset
// (as on Render) keeps the default of listening on all interfaces.
const HOST = process.env.HOST || undefined;

const server = app.listen(PORT, HOST, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

// Catch errors that happen outside of Express's request/response cycle
// (e.g. a bug in an async job) so the process logs clearly instead of
// dying silently or corrupting state.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  server.close(() => process.exit(1));
});

/**
 * Graceful shutdown (Phase 14): on SIGTERM (sent by container
 * orchestrators, process managers like systemd/pm2 on stop/restart) or
 * SIGINT (Ctrl+C locally), stop accepting NEW connections, let requests
 * already in flight finish naturally, then close the database pool and
 * exit cleanly. A hard timeout guards against a stuck connection
 * preventing shutdown forever — if requests haven't finished within 10s,
 * we force-exit rather than hang indefinitely (matching how most
 * orchestrators eventually SIGKILL an unresponsive process anyway, but
 * doing it ourselves with a log message instead of silently hanging).
 */
let shuttingDown = false;

const gracefulShutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n${signal} received: starting graceful shutdown...`);

  const forceExitTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out after 10s — forcing exit.');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  server.close(async (err) => {
    if (err) {
      console.error('Error while closing HTTP server:', err);
    } else {
      console.log('HTTP server closed — no longer accepting new connections.');
    }

    try {
      await pool.end();
      console.log('PostgreSQL pool closed.');
    } catch (poolErr) {
      console.error('Error while closing PostgreSQL pool:', poolErr);
    }

    clearTimeout(forceExitTimer);
    console.log('Graceful shutdown complete.');
    process.exit(err ? 1 : 0);
  });
};

/**
 * Phase 15: hourly cleanup of verification codes that can never be used
 * again (used / invalidated / expired, older than 24h). `unref()` so the
 * timer never keeps the process alive during shutdown. Lives here rather
 * than in app.js so importing the app in tests starts no timers.
 */
const runVerificationCodeCleanup = async () => {
  try {
    const removed = await cleanupStaleCodes(24);
    if (removed > 0) console.log(`Email verification cleanup: removed ${removed} stale code row(s).`);
  } catch (err) {
    console.error('Email verification cleanup failed:', err.message);
  }
};
setInterval(runVerificationCodeCleanup, 60 * 60 * 1000).unref();

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
