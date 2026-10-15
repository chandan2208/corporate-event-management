/**
 * Phase 15 — on-demand cleanup of stale email verification codes (used,
 * invalidated or expired rows older than 24 hours). The running server
 * also does this automatically every hour; this script is for operators
 * or an external cron.
 *
 * Run with: npm run cleanup:verification-codes
 */

require('dotenv').config();

const { pool } = require('../config/db');
const { deleteStaleCodes } = require('../models/emailVerification.model');

deleteStaleCodes(24)
  .then(async (removed) => {
    console.log(`Removed ${removed} stale verification code row(s).`);
    await pool.end();
  })
  .catch((err) => {
    console.error('Cleanup failed:', err.message);
    process.exit(1);
  });
