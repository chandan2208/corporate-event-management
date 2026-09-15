/**
 * Migration: create feedback table.
 *
 * Duplicate prevention is enforced at the DATABASE level via
 * UNIQUE(event_id, user_id) — this is the authoritative guarantee, not
 * just a service-layer pre-check. Two simultaneous submission attempts
 * from the same employee for the same event will both reach PostgreSQL;
 * exactly one INSERT wins, the other fails with a unique-violation error
 * (code 23505), which the service layer catches and turns into a clean
 * 409 — see feedback.service.js. No row locking is needed for this
 * (unlike seat allocation or check-in), because we're not computing
 * anything from existing state before deciding what to insert — we're
 * just asserting "this (event, user) pair has never submitted before",
 * which a unique index already guarantees atomically under concurrency.
 *
 * `registration_id` is also stored (not just event_id/user_id) so a
 * feedback row can always be traced back to the exact registration that
 * made the employee eligible (which seat, when they checked in, etc.),
 * without needing to store any of that data redundantly here.
 */

exports.up = (pgm) => {
  pgm.createTable('feedback', {
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
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'RESTRICT',
    },
    registration_id: {
      type: 'uuid',
      notNull: true,
      references: 'registrations(id)',
      onDelete: 'RESTRICT',
    },
    rating: {
      type: 'integer',
      notNull: true,
    },
    comment: {
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

  pgm.addConstraint('feedback', 'feedback_rating_range', 'CHECK (rating >= 1 AND rating <= 5)');

  // The authoritative duplicate-prevention guarantee.
  pgm.addConstraint('feedback', 'feedback_one_per_event_per_user', {
    unique: ['event_id', 'user_id'],
  });

  pgm.createIndex('feedback', 'event_id');
  pgm.createIndex('feedback', 'user_id');
  pgm.createIndex('feedback', 'registration_id');

  pgm.createTrigger('feedback', 'trg_feedback_set_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'set_updated_at',
    level: 'ROW',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('feedback');
};
