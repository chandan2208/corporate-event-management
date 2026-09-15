const { query } = require('../config/db');

/**
 * All queries here are aggregate/GROUP BY queries run directly in
 * PostgreSQL — nothing fetches full row sets into Node.js just to count
 * or average them in JavaScript. Every query is parameterized.
 */

const getEventCounts = async () => {
  const result = await query(
    `SELECT
       COUNT(*)::int AS total_events,
       COUNT(*) FILTER (WHERE status = 'PUBLISHED')::int AS published_events,
       COUNT(*) FILTER (WHERE status = 'PUBLISHED' AND event_date >= CURRENT_DATE)::int AS upcoming_events
     FROM events`
  );
  return result.rows[0];
};

const getRegistrationCounts = async () => {
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status <> 'CANCELLED')::int AS total_registrations,
       COUNT(*) FILTER (WHERE status IN ('CHECKED_IN', 'COMPLETED'))::int AS total_attendees
     FROM registrations`
  );
  return result.rows[0];
};

const getCertificateCounts = async () => {
  const result = await query(
    `SELECT
       COUNT(*)::int AS issued,
       COUNT(*) FILTER (WHERE revoked_at IS NULL)::int AS valid,
       COUNT(*) FILTER (WHERE revoked_at IS NOT NULL)::int AS revoked
     FROM certificates`
  );
  return result.rows[0];
};

const getEventStatusDistribution = async () => {
  const result = await query(`SELECT status, COUNT(*)::int AS count FROM events GROUP BY status`);
  return result.rows;
};

/**
 * Registrations per day over the given range, using the real
 * `created_at` timestamp. `days` is always an already-validated integer
 * by the time this is called (see adminDashboard.validator.js), and is
 * still passed as a bound parameter, never string-concatenated.
 */
const getRegistrationTrend = async (days) => {
  const result = await query(
    `SELECT date_trunc('day', created_at)::date AS date, COUNT(*)::int AS registrations
     FROM registrations
     WHERE created_at >= CURRENT_DATE - $1::int
     GROUP BY date_trunc('day', created_at)::date
     ORDER BY date ASC`,
    [days]
  );
  return result.rows;
};

/**
 * Attendance per day using `checked_in_at` — a registration has AT MOST
 * one check-in timestamp (Phase 6's atomic conditional UPDATE guarantees
 * this), so grouping by this column can never double-count attendance.
 */
const getAttendanceTrend = async (days) => {
  const result = await query(
    `SELECT date_trunc('day', checked_in_at)::date AS date, COUNT(*)::int AS attendees
     FROM registrations
     WHERE checked_in_at IS NOT NULL AND checked_in_at >= CURRENT_DATE - $1::int
     GROUP BY date_trunc('day', checked_in_at)::date
     ORDER BY date ASC`,
    [days]
  );
  return result.rows;
};

/**
 * Per-event performance data in ONE query using scalar subqueries rather
 * than multiple LEFT JOINs. Multiple LEFT JOINs across
 * registrations+feedback+certificates (all one-to-many from events)
 * would fan out into a cartesian product per event; scalar subqueries
 * avoid that entirely while still executing as a single query, each
 * backed by an existing index on the relevant `event_id` column. This is
 * the base dataset that event performance, popular events, and capacity
 * utilization are ALL derived from in the service layer — computed once,
 * sliced/sorted three ways in JS, rather than three separate queries.
 */
const getEventPerformanceData = async (statusFilter) => {
  const params = [];
  let whereClause = '';
  if (statusFilter) {
    params.push(statusFilter);
    whereClause = `WHERE e.status = $${params.length}`;
  }

  const result = await query(
    `SELECT
       e.id, e.title, e.event_date, e.capacity, e.status, e.created_at,
       (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status <> 'CANCELLED')::int AS registrations,
       (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status IN ('CHECKED_IN','COMPLETED'))::int AS attendance,
       (SELECT COUNT(*) FROM feedback f WHERE f.event_id = e.id)::int AS feedback_count,
       (SELECT COUNT(*) FROM certificates c WHERE c.event_id = e.id)::int AS certificates_count
     FROM events e
     ${whereClause}
     ORDER BY e.event_date DESC`,
    params
  );
  return result.rows;
};

const getFeedbackSummary = async () => {
  const totalsResult = await query(
    `SELECT COUNT(*)::int AS total, COALESCE(AVG(rating), 0)::float AS average FROM feedback`
  );
  const distributionResult = await query(
    `SELECT rating, COUNT(*)::int AS count FROM feedback GROUP BY rating`
  );
  return { totals: totalsResult.rows[0], distribution: distributionResult.rows };
};

const getTopRatedEvents = async (limit = 5) => {
  const result = await query(
    `SELECT e.id, e.title, AVG(f.rating)::float AS average_rating, COUNT(f.id)::int AS response_count
     FROM feedback f
     JOIN events e ON e.id = f.event_id
     GROUP BY e.id, e.title
     ORDER BY average_rating DESC, response_count DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
};

const getCertificatesByEvent = async (limit = 10) => {
  const result = await query(
    `SELECT e.id, e.title, COUNT(c.id)::int AS certificates_count
     FROM certificates c
     JOIN events e ON e.id = c.event_id
     GROUP BY e.id, e.title
     ORDER BY certificates_count DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
};

module.exports = {
  getEventCounts,
  getRegistrationCounts,
  getCertificateCounts,
  getEventStatusDistribution,
  getRegistrationTrend,
  getAttendanceTrend,
  getEventPerformanceData,
  getFeedbackSummary,
  getTopRatedEvents,
  getCertificatesByEvent,
};
