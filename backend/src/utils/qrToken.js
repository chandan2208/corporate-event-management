const crypto = require('crypto');

/**
 * Generates a cryptographically random, unguessable token to identify a
 * registration for QR check-in purposes (the actual QR code IMAGE is
 * generated in a later phase — this phase only creates and stores the
 * underlying token/reference).
 *
 * Deliberately NOT derived from the employee's id, email, or any other
 * personal data — it's pure random bytes, so it carries no sensitive
 * information if scanned/read, and it can't be guessed or computed by an
 * attacker who knows the employee's identity.
 */
const generateQrToken = () => crypto.randomBytes(32).toString('hex'); // 64 hex chars

module.exports = { generateQrToken };
