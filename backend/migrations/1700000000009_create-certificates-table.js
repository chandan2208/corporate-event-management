/**
 * Migration: create certificates table.
 *
 * ON DELETE behavior deliberately differs from sibling tables
 * (speakers/sessions/feedback all CASCADE from events): a certificate is
 * treated as a permanent record, so all three foreign keys here use
 * RESTRICT — nothing should ever silently destroy an issued certificate
 * as a side effect of deleting something else. In practice this is
 * mostly moot anyway: events can only be hard-deleted while still DRAFT
 * (see event.service.js), and a DRAFT event can never have a CHECKED_IN
 * registration, so no certificate could exist against it in the first
 * place.
 *
 * `registration_id` is UNIQUE — this is the core idempotency guarantee
 * from the spec: the same registration can never receive two active
 * certificate rows, enforced by the database itself, not just app logic.
 *
 * There is deliberately NO stored file path / PDF blob column: the PDF is
 * generated on demand, in memory, at download time (see
 * certificate.pdf.js) from the data already in this table plus its
 * joined event/user rows. This avoids ever needing to manage a
 * certificates directory on disk, which sidesteps filesystem-path
 * security concerns entirely.
 */

exports.up = (pgm) => {
  pgm.createTable('certificates', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    registration_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'registrations(id)',
      onDelete: 'RESTRICT',
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
    certificate_number: {
      type: 'varchar(50)',
      notNull: true,
      unique: true,
    },
    verification_token: {
      type: 'varchar(128)',
      notNull: true,
      unique: true,
    },
    issued_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    revoked_at: {
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

  pgm.createIndex('certificates', 'certificate_number');
  pgm.createIndex('certificates', 'verification_token');
  pgm.createIndex('certificates', 'registration_id');
  pgm.createIndex('certificates', 'event_id');
  pgm.createIndex('certificates', 'user_id');

  pgm.createTrigger('certificates', 'trg_certificates_set_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'set_updated_at',
    level: 'ROW',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('certificates');
};
