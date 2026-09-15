const { query } = require('../config/db');

/**
 * Data-access layer for the `users` table. Controllers/services never write
 * raw SQL themselves — they call these functions. Every query uses
 * parameterized placeholders ($1, $2, ...) so user input is never
 * concatenated into SQL strings, which is what prevents SQL injection.
 */

const PUBLIC_COLUMNS = `
  id, employee_code, name, email, role, department, designation,
  is_active, created_at, updated_at
`;

const findByEmail = async (email) => {
  const result = await query(
    `SELECT id, employee_code, name, email, password_hash, role, department,
            designation, is_active, created_at, updated_at
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
 * Used only by the internal admin-seed script — never exposed via a public
 * API — so admin accounts can't be created through the open registration
 * endpoint.
 */
const createUser = async ({
  name,
  email,
  passwordHash,
  role = 'employee',
  employeeCode = null,
  department = null,
  designation = null,
}) => {
  const result = await query(
    `INSERT INTO users (name, email, password_hash, role, employee_code, department, designation)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email.toLowerCase(), passwordHash, role, employeeCode, department, designation]
  );
  return result.rows[0];
};

module.exports = { findByEmail, findById, createUser };
