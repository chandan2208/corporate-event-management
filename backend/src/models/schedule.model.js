const { query } = require('../config/db');

/**
 * Data-access layer for the `event_sessions` table (the event's
 * schedule/agenda). Joins in the speaker's name/company where useful so
 * the frontend doesn't need a second round trip to show "who's speaking".
 */

const SESSION_COLUMNS = `
  s.id, s.event_id, s.title, s.description, s.speaker_id,
  s.start_time, s.end_time, s.location, s.created_at, s.updated_at
`;

const SPEAKER_SUMMARY_COLUMNS = `
  sp.name AS speaker_name, sp.company AS speaker_company, sp.designation AS speaker_designation
`;

const createSession = async (eventId, data) => {
  const result = await query(
    `INSERT INTO event_sessions (event_id, title, description, speaker_id, start_time, end_time, location)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, event_id, title, description, speaker_id, start_time, end_time, location, created_at, updated_at`,
    [
      eventId,
      data.title,
      data.description || null,
      data.speakerId || null,
      data.startTime,
      data.endTime,
      data.location || null,
    ]
  );
  return result.rows[0];
};

const findById = async (id) => {
  const result = await query(
    `SELECT ${SESSION_COLUMNS}, ${SPEAKER_SUMMARY_COLUMNS}
     FROM event_sessions s
     LEFT JOIN speakers sp ON sp.id = s.speaker_id
     WHERE s.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const listByEvent = async (eventId) => {
  const result = await query(
    `SELECT ${SESSION_COLUMNS}, ${SPEAKER_SUMMARY_COLUMNS}
     FROM event_sessions s
     LEFT JOIN speakers sp ON sp.id = s.speaker_id
     WHERE s.event_id = $1
     ORDER BY s.start_time ASC`,
    [eventId]
  );
  return result.rows;
};

const updateSession = async (id, data) => {
  const fields = [];
  const params = [];

  const fieldMap = {
    title: 'title',
    description: 'description',
    speakerId: 'speaker_id',
    startTime: 'start_time',
    endTime: 'end_time',
    location: 'location',
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
    `UPDATE event_sessions SET ${fields.join(', ')} WHERE id = $${params.length}
     RETURNING id, event_id, title, description, speaker_id, start_time, end_time, location, created_at, updated_at`,
    params
  );
  return result.rows[0] || null;
};

const deleteSession = async (id) => {
  const result = await query('DELETE FROM event_sessions WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
};

module.exports = { createSession, findById, listByEvent, updateSession, deleteSession };
