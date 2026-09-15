const { query, withTransaction } = require('../config/db');

/**
 * Data-access layer for the `registrations` table.
 *
 * Functions that take a `client` parameter (instead of using the shared
 * `query` helper) are meant to be called INSIDE a `withTransaction(...)`
 * block, using the same locked connection throughout — see
 * registration.service.js's `registerForEvent`. Mixing the pooled `query`
 * helper into that flow would defeat the row lock, since each `query()`
 * call can run on a different pooled connection.
 */

const REGISTRATION_COLUMNS = `
  r.id, r.event_id, r.user_id, r.seat_label, r.status, r.qr_token,
  r.registered_at, r.cancelled_at, r.checked_in_at, r.created_at, r.updated_at
`;

const EVENT_SUMMARY_COLUMNS = `
  e.title AS event_title, e.venue AS event_venue, e.event_date AS event_date,
  e.start_time AS event_start_time, e.end_time AS event_end_time, e.status AS event_status
`;

const USER_SUMMARY_COLUMNS = `
  u.name AS employee_name, u.email AS employee_email
`;

/**
 * Locks the event row for the duration of the current transaction so that
 * no other concurrent registration (or cancellation-driven re-check) for
 * the SAME event can proceed until this transaction commits or rolls
 * back. This is the core of the concurrency-safety strategy: every
 * registration attempt for a given event is fully serialized through this
 * lock, so capacity checks, duplicate checks, and seat selection can never
 * race against each other.
 */
const lockEventForUpdate = async (client, eventId) => {
  const result = await client.query('SELECT * FROM events WHERE id = $1 FOR UPDATE', [eventId]);
  return result.rows[0] || null;
};

const countActiveRegistrations = async (client, eventId) => {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count FROM registrations WHERE event_id = $1 AND status <> 'CANCELLED'`,
    [eventId]
  );
  return result.rows[0].count;
};

const getActiveSeatLabels = async (client, eventId) => {
  const result = await client.query(
    `SELECT seat_label FROM registrations WHERE event_id = $1 AND status <> 'CANCELLED'`,
    [eventId]
  );
  return result.rows.map((r) => r.seat_label);
};

const findActiveRegistrationForUser = async (client, eventId, userId) => {
  const result = await client.query(
    `SELECT id FROM registrations WHERE event_id = $1 AND user_id = $2 AND status <> 'CANCELLED'`,
    [eventId, userId]
  );
  return result.rows[0] || null;
};

const insertRegistration = async (client, { eventId, userId, seatLabel, qrToken }) => {
  const result = await client.query(
    `INSERT INTO registrations (event_id, user_id, seat_label, qr_token)
     VALUES ($1, $2, $3, $4)
     RETURNING ${REGISTRATION_COLUMNS.replace(/r\./g, '')}`,
    [eventId, userId, seatLabel, qrToken]
  );
  return result.rows[0];
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const findById = async (id) => {
  // A malformed id (not a UUID at all) would otherwise reach PostgreSQL
  // and come back as a raw "invalid input syntax for type uuid" error,
  // which the generic error handler would surface as an opaque 500.
  // Treating it as "not found" instead is both more correct (a malformed
  // id can never match a real row) and safer (no internal error detail
  // leaks to the client) — every caller already knows how to handle a
  // null/not-found result.
  if (!UUID_REGEX.test(id)) {
    return null;
  }

  const result = await query(
    `SELECT ${REGISTRATION_COLUMNS}, ${EVENT_SUMMARY_COLUMNS}
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     WHERE r.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const findActiveByEventAndUser = async (eventId, userId) => {
  const result = await query(
    `SELECT ${REGISTRATION_COLUMNS}, ${EVENT_SUMMARY_COLUMNS}
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     WHERE r.event_id = $1 AND r.user_id = $2 AND r.status <> 'CANCELLED'`,
    [eventId, userId]
  );
  return result.rows[0] || null;
};

const listForUser = async (userId, { page = 1, limit = 10, status } = {}) => {
  const conditions = ['r.user_id = $1'];
  const params = [userId];

  if (status) {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM registrations r ${whereClause}`,
    params
  );
  const total = countResult.rows[0].total;

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const result = await query(
    `SELECT ${REGISTRATION_COLUMNS}, ${EVENT_SUMMARY_COLUMNS}
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     ${whereClause}
     ORDER BY r.registered_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  return {
    registrations: result.rows,
    pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  };
};

/**
 * Locks the registration row identified by its QR token for the duration
 * of the current transaction. `FOR UPDATE OF r` locks ONLY the
 * registrations row (not the joined events row) — check-in doesn't need
 * to modify the event, so there's no reason to serialize check-ins
 * against unrelated event edits happening at the same time. This is the
 * lock that makes duplicate/concurrent scans of the SAME token safe: a
 * second simultaneous scan blocks here until the first transaction
 * commits, then re-reads the now-updated status and correctly sees it's
 * no longer REGISTERED.
 */
const lockByQrTokenForUpdate = async (client, token) => {
  const result = await client.query(
    `SELECT ${REGISTRATION_COLUMNS}, ${EVENT_SUMMARY_COLUMNS}
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     WHERE r.qr_token = $1
     FOR UPDATE OF r`,
    [token]
  );
  return result.rows[0] || null;
};

/**
 * Atomically transitions REGISTERED -> CHECKED_IN, setting checked_in_at.
 * The `AND status = 'REGISTERED'` guard means this UPDATE only ever
 * affects a row that is still eligible — if anything changed the status
 * between the lock above and this statement (which shouldn't be possible
 * given the lock, but this is defense in depth, same pattern as
 * `cancelIfRegistered`), zero rows are affected and `checked_in_at` is
 * never overwritten on an already-checked-in row.
 */
const markCheckedIn = async (client, id) => {
  const result = await client.query(
    `UPDATE registrations
     SET status = 'CHECKED_IN', checked_in_at = now()
     WHERE id = $1 AND status = 'REGISTERED'
     RETURNING ${REGISTRATION_COLUMNS.replace(/r\./g, '')}`,
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Fetches the full check-in response shape (registration + event +
 * employee name) using the SAME transactional client, called right after
 * `markCheckedIn` while still holding the row lock — safe, since we're
 * the one holding it.
 */
const findFullByIdWithClient = async (client, id) => {
  const result = await client.query(
    `SELECT ${REGISTRATION_COLUMNS}, ${EVENT_SUMMARY_COLUMNS}, ${USER_SUMMARY_COLUMNS}
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     JOIN users u ON u.id = r.user_id
     WHERE r.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Atomically cancels a registration ONLY if it's currently in a
 * cancellable state (REGISTERED). Using a single conditional UPDATE
 * (rather than a separate SELECT-then-UPDATE) avoids a race where a
 * check-in could happen between reading the status and writing the
 * cancellation — the WHERE clause is checked and applied atomically by
 * PostgreSQL itself.
 */
const cancelIfRegistered = async (id) => {
  const result = await query(
    `UPDATE registrations
     SET status = 'CANCELLED', cancelled_at = now()
     WHERE id = $1 AND status = 'REGISTERED'
     RETURNING ${REGISTRATION_COLUMNS.replace(/r\./g, '')}`,
    [id]
  );
  return result.rows[0] || null;
};

module.exports = {
  withTransaction,
  lockEventForUpdate,
  countActiveRegistrations,
  getActiveSeatLabels,
  findActiveRegistrationForUser,
  insertRegistration,
  findById,
  findActiveByEventAndUser,
  listForUser,
  cancelIfRegistered,
  lockByQrTokenForUpdate,
  markCheckedIn,
  findFullByIdWithClient,
};
