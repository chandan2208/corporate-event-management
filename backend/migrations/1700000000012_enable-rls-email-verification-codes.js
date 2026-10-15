/**
 * Migration: enable Row Level Security on `email_verification_codes`.
 *
 * Migration 1700000000010 enabled RLS on every table that existed at the
 * time; the Phase 15 table (created in 1700000000011) came later, so it
 * needs the same treatment. Without it, Supabase's Data API would expose
 * code hashes, attempt counters and user ids to anyone holding the
 * project's anon key. Same reasoning as 010: RLS with no policies denies
 * the API roles everything, while the backend connects as the table owner
 * and is unaffected (FORCE ROW LEVEL SECURITY is deliberately not set).
 */

exports.up = (pgm) => {
  pgm.sql('ALTER TABLE "email_verification_codes" ENABLE ROW LEVEL SECURITY');
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE "email_verification_codes" DISABLE ROW LEVEL SECURITY');
};
