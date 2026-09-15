const { query } = require('../config/db');

/**
 * Data-access layer for the `feedback` table. All queries are
 * parameterized. Duplicate-submission races are handled by letting the
 * database's own unique constraint do the work — see
 * `insertFeedback`'s caller in feedback.service.js, which catches
 * PostgreSQL's unique-violation error code (23505) rather than trying to
 * pre-check-then-insert (which would have a race window).
 */

const FEEDBACK_COLUMNS = `
  f.id, f.event_id, f.user_id, f.registration_id, f.rating, f.comment,
  f.created_at, f.updated_at
`;

const insertFeedback = async ({ eventId, userId, registrationId, rating, comment }) => {
  const result = await query(
    `INSERT INTO feedback (event_id, user_id, registration_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, event_id, user_id, registration_id, rating, comment, created_at, updated_at`,
    [eventId, userId, registrationId, rating, comment || null]
  );
  return result.rows[0];
};

const findByEventAndUser = async (eventId, userId) => {
  const result = await query(
    `SELECT ${FEEDBACK_COLUMNS} FROM feedback f WHERE f.event_id = $1 AND f.user_id = $2`,
    [eventId, userId]
  );
  return result.rows[0] || null;
};

/**
 * Admin listing — joins the employee's name so the admin can see who left
 * each piece of feedback, without exposing anything beyond that (no
 * email, no other account details).
 */
const listByEvent = async (eventId) => {
  const result = await query(
    `SELECT ${FEEDBACK_COLUMNS}, u.name AS employee_name
     FROM feedback f
     JOIN users u ON u.id = f.user_id
     WHERE f.event_id = $1
     ORDER BY f.created_at DESC`,
    [eventId]
  );
  return result.rows;
};

/**
 * Computes the summary directly from the database (no redundant stored
 * aggregates) — a single query gets the average/count, a second gets the
 * per-rating distribution. Both are cheap given the indexes on event_id.
 */
const getSummaryByEvent = async (eventId) => {
  const totalsResult = await query(
    `SELECT COUNT(*)::int AS total, COALESCE(AVG(rating), 0)::float AS average
     FROM feedback WHERE event_id = $1`,
    [eventId]
  );

  const distributionResult = await query(
    `SELECT rating, COUNT(*)::int AS count
     FROM feedback WHERE event_id = $1
     GROUP BY rating`,
    [eventId]
  );

  return {
    total: totalsResult.rows[0].total,
    average: totalsResult.rows[0].average,
    distributionRows: distributionResult.rows,
  };
};

module.exports = { insertFeedback, findByEventAndUser, listByEvent, getSummaryByEvent };
