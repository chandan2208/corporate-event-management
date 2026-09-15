const { query } = require('../config/db');

/**
 * New, additive queries for the employee dashboard — none of these touch
 * or modify feedback.model.js, schedule.model.js, or any other Phase 1-9
 * file. Both queries here are deliberately BATCHED (one round trip for
 * potentially many events/registrations) rather than looped per-item,
 * which is what avoids the N+1 pattern the phase explicitly warns against.
 */

/**
 * Returns which of the user's events already have feedback submitted,
 * plus the submission timestamp (used for the recent-activity feed) — a
 * single query across ALL of the user's events at once, rather than one
 * feedback lookup per registration.
 */
const getFeedbackForUser = async (userId) => {
  const result = await query(
    `SELECT event_id, created_at FROM feedback WHERE user_id = $1`,
    [userId]
  );
  return result.rows; // [{ event_id, created_at }, ...]
};

/**
 * Returns schedule sessions (with speaker info) for MULTIPLE events in a
 * single query using = ANY($1), instead of one query per event — this is
 * what lets the dashboard show "what's on the agenda" for every upcoming
 * event card without an N+1 query pattern.
 */
const getScheduleForEvents = async (eventIds) => {
  if (!eventIds.length) return [];
  const result = await query(
    `SELECT s.event_id, s.title, s.start_time, s.end_time, s.location,
            sp.name AS speaker_name, sp.designation AS speaker_designation, sp.company AS speaker_company
     FROM event_sessions s
     LEFT JOIN speakers sp ON sp.id = s.speaker_id
     WHERE s.event_id = ANY($1::uuid[])
     ORDER BY s.event_id, s.start_time ASC`,
    [eventIds]
  );
  return result.rows;
};

module.exports = { getFeedbackForUser, getScheduleForEvents };
