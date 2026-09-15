/**
 * Migration: create speakers table.
 *
 * Speakers belong to exactly one event (event_id FK). `ON DELETE CASCADE`
 * is used deliberately: events can only ever be hard-deleted while still
 * DRAFT (see event.service.js's deleteEvent — published events must be
 * cancelled, never deleted), so a cascading delete here only ever removes
 * speaker rows that belonged to a draft event an admin decided to scrap
 * entirely. There is no scenario where a real, published event's speakers
 * get silently wiped out.
 *
 * No event fields (title, date, etc.) are duplicated onto this table —
 * only the event_id reference. Anything about the event itself is always
 * fetched by joining back to `events`.
 */

exports.up = (pgm) => {
  pgm.createTable('speakers', {
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
    name: {
      type: 'varchar(150)',
      notNull: true,
    },
    designation: {
      type: 'varchar(150)',
    },
    company: {
      type: 'varchar(150)',
    },
    bio: {
      type: 'text',
    },
    photo_url: {
      type: 'text',
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

  pgm.createIndex('speakers', 'event_id');

  pgm.createTrigger('speakers', 'trg_speakers_set_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'set_updated_at',
    level: 'ROW',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('speakers');
};
