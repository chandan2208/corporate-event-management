const { query } = require('../config/db');

/**
 * Data-access layer for the `users` table. Controllers/services never write
 * raw SQL themselves — they call these functions. Every query uses
 * parameterized placeholders ($1, $2, ...) so user input is never
 * concatenated into SQL strings, which is what prevents SQL injection.
 */

const PUBLIC_COLUMNS = `
  id, employee_code, name, email, role, department, designation,
  is_active, email_verified, email_verified_at, created_at, updated_at
`;

const findByEmail = async (email) => {
  const result = await query(
    `SELECT id, employee_code, name, email, password_hash, role, department,
            designation, is_active, email_verified, email_verified_at,
            created_at, updated_at
     FROM users
     WHERE email = $1`,
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
};

const findById = async (id) => {
  const result = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Inserts a user row. Used by the public register endpoint (always
 * role='employee', email_verified=false) and by the internal admin-seed
 * script (role='admin', email_verified=true) — admin accounts can't be
 * created through the open registration endpoint.
 *
 * Phase 15: accepts an optional transaction `client` so registration can
 * create the user AND its first verification code atomically.
 */
const createUser = async (
  {
    name,
    email,
    passwordHash,
    role = 'employee',
    employeeCode = null,
    department = null,
    designation = null,
    emailVerified = false,
  },
  client = null
) => {
  const executor = client || { query };
  const result = await executor.query(
    `INSERT INTO users (name, email, password_hash, role, employee_code, department, designation,
                        email_verified, email_verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $8 THEN now() ELSE NULL END)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email.toLowerCase(), passwordHash, role, employeeCode, department, designation, emailVerified]
  );
  return result.rows[0];
};

/**
 * Phase 15: flips a user to verified. Idempotent; must be called inside
 * the same transaction that consumes the verification code.
 */
const markEmailVerified = async (client, userId) => {
  const executor = client || { query };
  const result = await executor.query(
    `UPDATE users
     SET email_verified = true,
         email_verified_at = COALESCE(email_verified_at, now())
     WHERE id = $1
     RETURNING ${PUBLIC_COLUMNS}`,
    [userId]
  );
  return result.rows[0] || null;
};

module.exports = { findByEmail, findById, createUser, markEmailVerified };
