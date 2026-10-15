/**
 * Migration: enable Row Level Security on every application table.
 *
 * This app never talks to the database through Supabase's auto-generated
 * Data API (PostgREST/GraphQL) — all access goes through this Express
 * backend, which enforces authorization itself (authenticate/authorize
 * middleware). But when the database is hosted on Supabase, every table in
 * the `public` schema is ALSO reachable through that Data API with the
 * project's anon key, and without RLS that would expose e.g. users'
 * password hashes to anyone holding the key.
 *
 * Enabling RLS with NO policies denies all rows to those API roles
 * (anon/authenticated). The backend is unaffected: it connects as the
 * role that created (and therefore owns) these tables, and a table owner
 * bypasses RLS unless FORCE ROW LEVEL SECURITY is set — which it
 * deliberately is not here. On plain PostgreSQL (local, Render) this is
 * equally harmless for the same reason.
 *
 * `pgmigrations` (node-pg-migrate's own bookkeeping table) is included:
 * it also lives in `public` and has no reason to be publicly readable.
 */

const TABLES = [
  'users',
  'events',
  'registrations',
  'speakers',
  'event_sessions',
  'feedback',
  'certificates',
  'pgmigrations',
];

exports.up = (pgm) => {
  TABLES.forEach((table) => {
    pgm.sql(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  });
};

exports.down = (pgm) => {
  TABLES.forEach((table) => {
    pgm.sql(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
  });
};
