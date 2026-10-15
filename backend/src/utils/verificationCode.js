const crypto = require('crypto');

/**
 * Phase 15 — email verification code helpers.
 *
 * Generation: `crypto.randomInt` draws from the OS CSPRNG (never
 * Math.random(), never a timestamp), uniformly over 000000–999999.
 *
 * Storage: a 6-digit code has only 10^6 possibilities, so a plain
 * SHA-256 of it could be brute-forced offline in well under a second by
 * anyone who obtained a database dump. Instead we store a keyed
 * HMAC-SHA256, bound to the user id, using a server-side secret that never
 * lives in the database:
 *
 *   code_hash = HMAC-SHA256(key, "<userId>:<code>")
 *
 * key = EMAIL_VERIFICATION_SECRET if set, otherwise a value derived from
 * JWT_SECRET with a fixed domain-separation label (so an existing
 * deployment doesn't need a NEW required secret just to start up, and the
 * derived key can never be confused with the JWT signing key itself).
 *
 * Comparison uses crypto.timingSafeEqual.
 *
 * Codes are NEVER logged and NEVER returned in API responses — the only
 * place a raw code ever goes is into the outgoing email body.
 */

const CODE_LENGTH = 6;
const CODE_REGEX = /^\d{6}$/;

const generateVerificationCode = () =>
  crypto.randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, '0');

const getHmacKey = () => {
  const dedicated = process.env.EMAIL_VERIFICATION_SECRET;
  if (dedicated && dedicated.trim() !== '') return dedicated;

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    // validateEnv() makes this unreachable in a running server; guard anyway
    // so a misconfiguration can never silently produce an unkeyed hash.
    throw new Error('No secret available for hashing verification codes');
  }
  return crypto
    .createHash('sha256')
    .update(`cems-email-verification-v1:${jwtSecret}`)
    .digest();
};

const hashVerificationCode = (userId, code) =>
  crypto.createHmac('sha256', getHmacKey()).update(`${userId}:${code}`).digest('hex');

const verificationCodeMatches = (userId, code, storedHash) => {
  if (typeof code !== 'string' || !CODE_REGEX.test(code)) return false;
  if (typeof storedHash !== 'string' || storedHash.length !== 64) return false;

  const candidate = Buffer.from(hashVerificationCode(userId, code), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
};

/**
 * "username@gmail.com" -> "u*******@gmail.com". Used anywhere an address
 * is echoed back in a public response, so full addresses aren't exposed
 * unnecessarily (Phase 15, section 15).
 */
const maskEmail = (email) => {
  if (typeof email !== 'string') return '';
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.length > 1 ? local[0] : '';
  const stars = '*'.repeat(Math.min(Math.max(local.length - visible.length, 3), 8));
  return `${visible}${stars}@${domain}`;
};

module.exports = {
  CODE_LENGTH,
  CODE_REGEX,
  generateVerificationCode,
  hashVerificationCode,
  verificationCodeMatches,
  maskEmail,
};
