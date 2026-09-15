/**
 * Migration: create events table.
 *
 * Business rules enforced at the DATABASE level (not just app code), so
 * they hold even if a bug in a future feature bypasses the service layer:
 *   - capacity must be a positive number
 *   - end_time must be after start_time
 *   - status can only ever be one of the four defined values
 */

exports.up = (pgm) => {
  pgm.createType('event_status', ['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']);

  pgm.createTable('events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    title: {
      type: 'varchar(200)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    venue: {
      type: 'varchar(200)',
      notNull: true,
    },
    event_date: {
      type: 'date',
      notNull: true,
    },
    start_time: {
      type: 'time',
      notNull: true,
    },
    end_time: {
      type: 'time',
      notNull: true,
    },
    capacity: {
      type: 'integer',
      notNull: true,
    },
    registration_deadline: {
      type: 'timestamptz',
      notNull: true,
    },
    status: {
      type: 'event_status',
      notNull: true,
      default: 'DRAFT',
    },
    created_by: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'RESTRICT', // never silently orphan an event's creator reference
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

  pgm.addConstraint('events', 'events_capacity_positive', 'CHECK (capacity > 0)');
  pgm.addConstraint('events', 'events_end_after_start', 'CHECK (end_time > start_time)');

  // Filtering by status (employee "published only" queries, admin filters)
  // and sorting/filtering by date are the two most common access patterns.
  pgm.createIndex('events', 'status');
  pgm.createIndex('events', 'event_date');
  pgm.createIndex('events', 'created_by');

  pgm.createTrigger('events', 'trg_events_set_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'set_updated_at',
    level: 'ROW',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('events');
  pgm.dropType('event_status');
};
