/**
 * Migration: add checked_in_at to registrations.
 *
 * No new table is introduced for attendance — per the existing design
 * (registration_status already includes CHECKED_IN and COMPLETED), a
 * single nullable timestamp column is enough to record WHEN a
 * registration was checked in, alongside the existing `status` column
 * that already records WHETHER it was. Adding a whole separate
 * "attendance" table here would just be duplicating what `registrations`
 * already models, with no architectural benefit.
 *
 * qr_token already has a UNIQUE constraint (and therefore a unique btree
 * index) from the Phase 4 migration — the check-in flow's lookup by
 * token is already backed by an index with no further migration needed.
 */

exports.up = (pgm) => {
  pgm.addColumn('registrations', {
    checked_in_at: {
      type: 'timestamptz',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('registrations', 'checked_in_at');
};
