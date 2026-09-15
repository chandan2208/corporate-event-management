/**
 * Migration: create registrations table.
 *
 * Two PARTIAL unique indexes are the defense-in-depth layer underneath the
 * application's row-locking strategy (see registration.service.js):
 *   - one active (non-cancelled) registration per (event, employee)
 *   - one active (non-cancelled) registration per (event, seat)
 * "Partial" (the WHERE clause) matters: an employee who cancels and later
 * re-registers gets a NEW row, and the OLD cancelled row must not block
 * that — the constraint only protects against two SIMULTANEOUSLY ACTIVE
 * registrations/seats, not against having a cancelled one in history.
 *
 * These indexes are a safety net, not the primary concurrency control —
 * the application still explicitly locks the parent event row
 * (SELECT ... FOR UPDATE) before checking capacity/seats/duplicates, which
 * is what actually serializes concurrent registration attempts for the
 * same event. If that logic ever had a bug, these constraints are what
 * would still stop the database from ending up in an inconsistent state.
 */

exports.up = (pgm) => {
  pgm.createType('registration_status', ['REGISTERED', 'CANCELLED', 'CHECKED_IN', 'COMPLETED']);

  pgm.createTable('registrations', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    event_id: {
      type: 'uuid',
      notNull: true,
      references: 'events(id)',
      onDelete: 'RESTRICT',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'RESTRICT',
    },
    seat_label: {
      type: 'varchar(20)',
      notNull: true,
    },
    status: {
      type: 'registration_status',
      notNull: true,
      default: 'REGISTERED',
    },
    qr_token: {
      type: 'varchar(128)',
      notNull: true,
      unique: true,
    },
    registered_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    cancelled_at: {
      type: 'timestamptz',
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

  // One active registration per employee per event.
  pgm.createIndex('registrations', ['event_id', 'user_id'], {
    name: 'ux_registrations_event_user_active',
    unique: true,
    where: "status <> 'CANCELLED'",
  });

  // One active registration per seat per event — no two active
  // registrations can ever hold the same seat.
  pgm.createIndex('registrations', ['event_id', 'seat_label'], {
    name: 'ux_registrations_event_seat_active',
    unique: true,
    where: "status <> 'CANCELLED'",
  });

  pgm.createIndex('registrations', 'user_id');
  pgm.createIndex('registrations', 'event_id');
  pgm.createIndex('registrations', 'status');

  pgm.createTrigger('registrations', 'trg_registrations_set_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'set_updated_at',
    level: 'ROW',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('registrations');
  pgm.dropType('registration_status');
};
