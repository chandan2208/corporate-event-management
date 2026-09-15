/**
 * Adds a reusable trigger function that automatically sets `updated_at =
 * now()` on every UPDATE. Without this, every table that needs an
 * `updated_at` column would need application code to remember to set it —
 * easy to forget in one code path and end up with stale timestamps. Doing
 * it in the database guarantees it's always correct.
 *
 * Applied retroactively to `users` (created in Phase 2) and to the new
 * `events` table created in the next migration.
 */

exports.up = (pgm) => {
  pgm.createFunction(
    'set_updated_at',
    [],
    {
      returns: 'trigger',
      language: 'plpgsql',
      replace: true,
    },
    `
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    `
  );

  pgm.createTrigger('users', 'trg_users_set_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'set_updated_at',
    level: 'ROW',
  });
};

exports.down = (pgm) => {
  pgm.dropTrigger('users', 'trg_users_set_updated_at');
  pgm.dropFunction('set_updated_at', []);
};
