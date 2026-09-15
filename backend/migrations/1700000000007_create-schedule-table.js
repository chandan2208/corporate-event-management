/**
 * Migration: create event_sessions table (the event's schedule/agenda).
 *
 * Named `event_sessions` rather than `schedule` — "schedule" is a vague,
 * easily-overloaded word; this table holds individual agenda ITEMS
 * (keynote, lunch, panel, etc.), so a concrete noun describes it better.
 * The API/URL path still says "schedule" (e.g. GET /api/events/:id/schedule)
 * since that's the user-facing concept.
 *
 * start_time/end_time are TIME (not TIMESTAMPTZ) columns — matching the
 * same convention already used on `events.start_time`/`events.end_time` —
 * because every session happens on the event's single existing
 * `event_date`; a session doesn't need its own separate date. This also
 * keeps "is this session within the event's hours" a simple TIME
 * comparison (enforced in the service layer — see schedule.service.js).
 *
 * `speaker_id` is nullable (a session like "Lunch" or "Registration" has
 * no speaker) and uses ON DELETE SET NULL: deleting a speaker should not
 * delete the sessions that referenced them — the session's own content
 * (title, time, location) is still meaningful without a speaker attached.
 */

exports.up = (pgm) => {
  pgm.createTable('event_sessions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    event_id: {
      type: 'uuid',
      notNull: true,
      references: 'events(id)',
      onDelete: 'CASCADE',
    },
    title: {
      type: 'varchar(200)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    speaker_id: {
      type: 'uuid',
      references: 'speakers(id)',
      onDelete: 'SET NULL',
    },
    start_time: {
      type: 'time',
      notNull: true,
    },
    end_time: {
      type: 'time',
      notNull: true,
    },
    location: {
      type: 'varchar(150)',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint('event_sessions', 'event_sessions_end_after_start', 'CHECK (end_time > start_time)');

  pgm.createIndex('event_sessions', 'event_id');
  pgm.createIndex('event_sessions', 'speaker_id');
  // Sessions are always displayed in chronological order within an event.
  pgm.createIndex('event_sessions', ['event_id', 'start_time']);

  pgm.createTrigger('event_sessions', 'trg_event_sessions_set_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'set_updated_at',
    level: 'ROW',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('event_sessions');
};
