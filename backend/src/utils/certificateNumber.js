const crypto = require('crypto');

/**
 * Generates a professional, human-readable certificate number like
 * "CERT-2026-A1B2C3D4". The random suffix uses crypto.randomBytes (not
 * Math.random), so it's collision-resistant the same way registration QR
 * tokens are — this is what "cryptographically secure random generation"
 * means in the spec.
 *
 * 8 uppercase hex characters gives 16^8 (~4.3 billion) possibilities per
 * year, making an accidental collision astronomically unlikely even at
 * huge scale — and the caller (certificate.service.js) still retries on
 * the rare unique-constraint violation as a defensive backstop, the same
 * way it does for verification_token.
 */
const generateCertificateNumber = (issuedAt = new Date()) => {
  const year = issuedAt.getFullYear();
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars
  return `CERT-${year}-${suffix}`;
};

module.exports = { generateCertificateNumber };
