const { query } = require('../config/db');

/**
 * Data-access layer for the `speakers` table. All queries are
 * parameterized — user input (names, bios, ids) is never concatenated
 * into SQL strings.
 */

const SPEAKER_COLUMNS = `
  id, event_id, name, designation, company, bio, photo_url, created_at, updated_at
`;

const createSpeaker = async (eventId, data) => {
  const result = await query(
    `INSERT INTO speakers (event_id, name, designation, company, bio, photo_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${SPEAKER_COLUMNS}`,
    [eventId, data.name, data.designation || null, data.company || null, data.bio || null, data.photoUrl || null]
  );
  return result.rows[0];
};

const findById = async (id) => {
  const result = await query(`SELECT ${SPEAKER_COLUMNS} FROM speakers WHERE id = $1`, [id]);
  return result.rows[0] || null;
};

const listByEvent = async (eventId) => {
  const result = await query(
    `SELECT ${SPEAKER_COLUMNS} FROM speakers WHERE event_id = $1 ORDER BY created_at ASC`,
    [eventId]
  );
  return result.rows;
};

const updateSpeaker = async (id, data) => {
  const fields = [];
  const params = [];

  const fieldMap = {
    name: 'name',
    designation: 'designation',
    company: 'company',
    bio: 'bio',
    photoUrl: 'photo_url',
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
    `UPDATE speakers SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING ${SPEAKER_COLUMNS}`,
    params
  );
  return result.rows[0] || null;
};

const deleteSpeaker = async (id) => {
  const result = await query('DELETE FROM speakers WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
};

module.exports = { createSpeaker, findById, listByEvent, updateSpeaker, deleteSpeaker };
