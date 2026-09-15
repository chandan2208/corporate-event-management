const { query } = require('../config/db');

/**
 * Data-access layer for the `certificates` table. All queries are
 * parameterized. This file also includes a couple of read-only queries
 * that join `registrations`/`events`/`users` for convenience — these are
 * NEW, additive queries defined here, not modifications to
 * registration.model.js or event.model.js from earlier phases.
 */

const CERT_COLUMNS = `
  c.id, c.registration_id, c.event_id, c.user_id, c.certificate_number,
  c.verification_token, c.issued_at, c.revoked_at, c.created_at, c.updated_at
`;

const EVENT_COLUMNS = `e.title AS event_title, e.event_date AS event_date, e.venue AS event_venue`;
const USER_COLUMNS = `u.name AS employee_name`;

/**
 * Everything needed to decide eligibility AND (if eligible) render a
 * certificate: the registration's own status plus its parent event and
 * owning user, in one query.
 */
const findRegistrationForCertificate = async (registrationId) => {
  const result = await query(
    `SELECT r.id, r.status, r.event_id, r.user_id,
            ${EVENT_COLUMNS}, ${USER_COLUMNS}
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     JOIN users u ON u.id = r.user_id
     WHERE r.id = $1`,
    [registrationId]
  );
  return result.rows[0] || null;
};

const insertCertificate = async ({ registrationId, eventId, userId, certificateNumber, verificationToken }) => {
  const result = await query(
    `INSERT INTO certificates (registration_id, event_id, user_id, certificate_number, verification_token)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, registration_id, event_id, user_id, certificate_number, verification_token,
               issued_at, revoked_at, created_at, updated_at`,
    [registrationId, eventId, userId, certificateNumber, verificationToken]
  );
  return result.rows[0];
};

const findByRegistrationId = async (registrationId) => {
  const result = await query(
    `SELECT ${CERT_COLUMNS} FROM certificates c WHERE c.registration_id = $1`,
    [registrationId]
  );
  return result.rows[0] || null;
};

const findById = async (id) => {
  const result = await query(
    `SELECT ${CERT_COLUMNS}, ${EVENT_COLUMNS}, ${USER_COLUMNS}
     FROM certificates c
     JOIN events e ON e.id = c.event_id
     JOIN users u ON u.id = c.user_id
     WHERE c.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const findByVerificationToken = async (token) => {
  const result = await query(
    `SELECT ${CERT_COLUMNS}, ${EVENT_COLUMNS}, ${USER_COLUMNS}
     FROM certificates c
     JOIN events e ON e.id = c.event_id
     JOIN users u ON u.id = c.user_id
     WHERE c.verification_token = $1`,
    [token]
  );
  return result.rows[0] || null;
};

const listForUser = async (userId) => {
  const result = await query(
    `SELECT ${CERT_COLUMNS}, ${EVENT_COLUMNS}
     FROM certificates c
     JOIN events e ON e.id = c.event_id
     WHERE c.user_id = $1
     ORDER BY c.issued_at DESC`,
    [userId]
  );
  return result.rows;
};

const listAll = async ({ page = 1, limit = 10, status, eventId } = {}) => {
  const conditions = [];
  const params = [];

  if (status === 'REVOKED') {
    conditions.push('c.revoked_at IS NOT NULL');
  } else if (status === 'VALID') {
    conditions.push('c.revoked_at IS NULL');
  }

  if (eventId) {
    params.push(eventId);
    conditions.push(`c.event_id = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const countResult = await query(`SELECT COUNT(*)::int AS total FROM certificates c ${whereClause}`, params);
  const total = countResult.rows[0].total;

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const result = await query(
    `SELECT ${CERT_COLUMNS}, ${EVENT_COLUMNS}, ${USER_COLUMNS}
     FROM certificates c
     JOIN events e ON e.id = c.event_id
     JOIN users u ON u.id = c.user_id
     ${whereClause}
     ORDER BY c.issued_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  return {
    certificates: result.rows,
    pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  };
};

/**
 * Atomic conditional revoke — only affects a row that isn't already
 * revoked, same pattern as registration cancellation and check-in.
 */
const revokeIfActive = async (id) => {
  const result = await query(
    `UPDATE certificates SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL
     RETURNING id, registration_id, event_id, user_id, certificate_number, verification_token,
               issued_at, revoked_at, created_at, updated_at`,
    [id]
  );
  return result.rows[0] || null;
};

module.exports = {
  findRegistrationForCertificate,
  insertCertificate,
  findByRegistrationId,
  findById,
  findByVerificationToken,
  listForUser,
  listAll,
  revokeIfActive,
};
