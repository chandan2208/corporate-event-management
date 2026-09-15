const { query } = require('../config/db');

/**
 * Data-access layer for the `events` table. All queries are parameterized
 * ($1, $2, ...) to prevent SQL injection — user input (search terms,
 * filters) is never concatenated into the SQL string.
 */

const EVENT_COLUMNS = `
  e.id, e.title, e.description, e.venue, e.event_date, e.start_time, e.end_time,
  e.capacity, e.registration_deadline, e.status, e.created_by, e.created_at, e.updated_at,
  u.name AS created_by_name
`;

// Same fix applied to registration.model.js back in Phase 5 (documented at
// the time as "the same class of defensive fix likely applies to
// event.model.js too" but not yet done) — finally applied here after
// Phase 13 testing concretely caught the gap: a malformed (non-UUID) id
// reaching a plain `WHERE id = $1` query crashes with a raw Postgres
// "invalid input syntax for type uuid" error, surfaced as an opaque 500.
// Treating it as "not found" is both more correct (a malformed id can
// never match a real row) and safer (no internal error detail leaks).
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createEvent = async (data, createdBy) => {
  const result = await query(
    `INSERT INTO events
       (title, description, venue, event_date, start_time, end_time,
        capacity, registration_deadline, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, title, description, venue, event_date, start_time, end_time,
               capacity, registration_deadline, status, created_by, created_at, updated_at`,
    [
      data.title,
      data.description || null,
      data.venue,
      data.eventDate,
      data.startTime,
      data.endTime,
      data.capacity,
      data.registrationDeadline,
      createdBy,
    ]
  );
  return result.rows[0];
};

const findById = async (id) => {
  if (!UUID_REGEX.test(id)) {
    return null;
  }

  const result = await query(
    `SELECT ${EVENT_COLUMNS}
     FROM events e
     JOIN users u ON u.id = e.created_by
     WHERE e.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Shared list function for both admin and employee views. Admin can pass
 * any status filter (or none, to see everything); the employee-facing
 * controller always forces `status = 'PUBLISHED'` before calling this, so
 * the restriction lives in one predictable place rather than being
 * duplicated across ad-hoc queries.
 */
const listEvents = async ({ status, search, page = 1, limit = 10, sortBy = 'event_date', order = 'asc' }) => {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`e.status = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(e.title ILIKE $${params.length} OR e.venue ILIKE $${params.length})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Whitelist sortable columns — never interpolate a client-supplied
  // column/direction name directly into SQL.
  const sortableColumns = ['event_date', 'created_at', 'title', 'capacity'];
  const safeSortBy = sortableColumns.includes(sortBy) ? sortBy : 'event_date';
  const safeOrder = order === 'desc' ? 'DESC' : 'ASC';

  const offset = (page - 1) * limit;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM events e ${whereClause}`,
    params
  );
  const total = countResult.rows[0].total;

  params.push(limit);
  const limitParamIndex = params.length;
  params.push(offset);
  const offsetParamIndex = params.length;

  const result = await query(
    `SELECT ${EVENT_COLUMNS}
     FROM events e
     JOIN users u ON u.id = e.created_by
     ${whereClause}
     ORDER BY e.${safeSortBy} ${safeOrder}
     LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
    params
  );

  return {
    events: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

const updateEvent = async (id, data) => {
  const fields = [];
  const params = [];

  const fieldMap = {
    title: 'title',
    description: 'description',
    venue: 'venue',
    eventDate: 'event_date',
    startTime: 'start_time',
    endTime: 'end_time',
    capacity: 'capacity',
    registrationDeadline: 'registration_deadline',
  };

  Object.entries(fieldMap).forEach(([key, column]) => {
    if (data[key] !== undefined) {
      params.push(data[key]);
      fields.push(`${column} = $${params.length}`);
    }
  });

  if (fields.length === 0) {
    return findById(id);
  }

  params.push(id);
  const result = await query(
    `UPDATE events SET ${fields.join(', ')} WHERE id = $${params.length}
     RETURNING id, title, description, venue, event_date, start_time, end_time,
               capacity, registration_deadline, status, created_by, created_at, updated_at`,
    params
  );
  return result.rows[0] || null;
};

const updateStatus = async (id, status) => {
  const result = await query(
    `UPDATE events SET status = $1 WHERE id = $2
     RETURNING id, title, description, venue, event_date, start_time, end_time,
               capacity, registration_deadline, status, created_by, created_at, updated_at`,
    [status, id]
  );
  return result.rows[0] || null;
};

const deleteEvent = async (id) => {
  const result = await query('DELETE FROM events WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
};

module.exports = {
  createEvent,
  findById,
  listEvents,
  updateEvent,
  updateStatus,
  deleteEvent,
};
