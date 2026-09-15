const bcrypt = require('bcrypt');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;

/**
 * Hashes a plain-text password before it's ever stored in the database.
 * We NEVER store or log plain-text passwords anywhere.
 */
const hashPassword = async (plainPassword) => {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
};

/**
 * Compares a plain-text password (from a login request) against the stored
 * hash. Returns true/false — never reveals which part of a credential pair
 * was wrong, so the caller should always respond with a generic
 * "invalid email or password" message regardless of which one failed.
 */
const comparePassword = async (plainPassword, passwordHash) => {
  return bcrypt.compare(plainPassword, passwordHash);
};

module.exports = { hashPassword, comparePassword };
