const { query, withTransaction } = require('../config/db');

/**
 * Data-access layer for `email_verification_codes` (Phase 15).
 *
 * Same conventions as registration.model.js: functions taking a `client`
 * run INSIDE a withTransaction(...) block on one locked connection; every
 * query is parameterized. All time comparisons use the database clock
 * (now()) so app-server clock skew can never extend or shorten a code's
 * lifetime.
 */

/**
 * Locks the user's row for the rest of the transaction. Every code
 * issue/verify for the same user is serialized through this lock, so two
 * simultaneous resends can't both pass the cooldown check, and two
 * simultaneous guesses can't both read the same attempt counter.
 */
const lockUserForVerification = async (client, userId) => {
  const result = await client.query(
    `SELECT id, name, email, is_active, email_verified
     FROM users WHERE id = $1 FOR UPDATE`,
    [userId]
  );
  return result.rows[0] || null;
};

/** Seconds since the most recent code (any state) was issued, or null. */
const secondsSinceLastCode = async (client, userId) => {
  const result = await client.query(
    `SELECT EXTRACT(EPOCH FROM (now() - created_at))::float AS age
     FROM email_verification_codes
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] ? result.rows[0].age : null;
};

const invalidateActiveCodes = async (client, userId) => {
  await client.query(
    `UPDATE email_verification_codes
     SET invalidated_at = now()
     WHERE user_id = $1 AND used_at IS NULL AND invalidated_at IS NULL`,
    [userId]
  );
};

const insertCode = async (client, { userId, codeHash, ttlMinutes, maxAttempts }) => {
  const result = await client.query(
    `INSERT INTO email_verification_codes (user_id, code_hash, expires_at, max_attempts)
     VALUES ($1, $2, now() + make_interval(mins => $3), $4)
     RETURNING id, expires_at`,
    [userId, codeHash, ttlMinutes, maxAttempts]
  );
  return result.rows[0];
};

/**
 * The single active code for a user (the partial unique index guarantees
 * there's at most one), locked, with an `is_expired` flag computed by the
 * database clock.
 */
const findActiveCodeForUpdate = async (client, userId) => {
  const result = await client.query(
    `SELECT id, code_hash, attempts, max_attempts, (expires_at <= now()) AS is_expired
     FROM email_verification_codes
     WHERE user_id = $1 AND used_at IS NULL AND invalidated_at IS NULL
     FOR UPDATE`,
    [userId]
  );
  return result.rows[0] || null;
};

const recordFailedAttempt = async (client, codeId) => {
  const result = await client.query(
    `UPDATE email_verification_codes
     SET attempts = attempts + 1,
         invalidated_at = CASE WHEN attempts + 1 >= max_attempts THEN now() ELSE invalidated_at END
     WHERE id = $1
     RETURNING attempts, max_attempts, (invalidated_at IS NOT NULL) AS locked`,
    [codeId]
  );
  return result.rows[0];
};

const invalidateCode = async (client, codeId) => {
  await client.query(
    `UPDATE email_verification_codes SET invalidated_at = now()
     WHERE id = $1 AND invalidated_at IS NULL`,
    [codeId]
  );
};

const markCodeUsed = async (client, codeId) => {
  await client.query(`UPDATE email_verification_codes SET used_at = now() WHERE id = $1`, [codeId]);
};

/**
 * Removes a code whose email could not be delivered, so the user isn't
 * stuck behind the resend cooldown for a message they never received.
 */
const deleteCodeById = async (codeId) => {
  await query(`DELETE FROM email_verification_codes WHERE id = $1`, [codeId]);
};

/**
 * Cleanup strategy: rows that can never be used again (used, invalidated
 * or expired) are kept for `retentionHours` as a short audit trail, then
 * deleted. Runs hourly from server.js and on demand via
 * `npm run cleanup:verification-codes`.
 */
const deleteStaleCodes = async (retentionHours = 24) => {
  const result = await query(
    `DELETE FROM email_verification_codes
     WHERE (used_at IS NOT NULL OR invalidated_at IS NOT NULL OR expires_at <= now())
       AND created_at < now() - make_interval(hours => $1)`,
    [retentionHours]
  );
  return result.rowCount;
};

module.exports = {
  withTransaction,
  lockUserForVerification,
  secondsSinceLastCode,
  invalidateActiveCodes,
  insertCode,
  findActiveCodeForUpdate,
  recordFailedAttempt,
  invalidateCode,
  markCodeUsed,
  deleteCodeById,
  deleteStaleCodes,
};
