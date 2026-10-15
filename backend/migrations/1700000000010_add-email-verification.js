/**
 * Migration (Phase 15): email verification.
 *
 * 1. `users` gains `email_verified` + `email_verified_at`.
 * 2. A separate `email_verification_codes` table holds one-time codes.
 *    Codes live in their own table (rather than as extra columns on
 *    `users`) so that:
 *      - each issued code has its own expiry / attempt counter / used-at
 *        audit trail,
 *      - "invalidate every previous code on resend" is a single UPDATE,
 *      - expired/used rows can be cleaned up without ever touching `users`.
 *
 * Only a keyed HMAC-SHA256 of each code is stored (`code_hash`), never the
 * raw 6-digit code — see src/utils/verificationCode.js.
 *
 * EXISTING-ACCOUNT STRATEGY (Phase 15, section 11):
 *   - Every existing row keeps its name, email, password_hash, role,
 *     department/designation, registrations, attendance, feedback and
 *     certificates untouched — this migration only ADDS columns.
 *   - Existing ADMIN accounts were created through the trusted
 *     `npm run seed:admin` script (never the public register endpoint), so
 *     they are marked verified here. Admin login keeps working immediately.
 *   - Existing EMPLOYEE accounts get a controlled one-time verification
 *     requirement (`email_verified = false`). Their next login returns
 *     "Please verify your email before signing in." and the login page
 *     offers "Resend code" -> a code is emailed -> they verify once -> they
 *     log in normally with their unchanged password. Operators can also
 *     verify an account directly with `npm run verify:user -- <email>`.
 */

exports.up = (pgm) => {
  pgm.addColumns('users', {
    email_verified: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    email_verified_at: {
      type: 'timestamptz',
    },
  });

  // Trusted, seed-created admin accounts are treated as verified.
  pgm.sql(`
    UPDATE users
    SET email_verified = true,
        email_verified_at = now()
    WHERE role = 'admin'
  `);

  pgm.createTable('email_verification_codes', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    code_hash: {
      type: 'varchar(64)', // hex-encoded HMAC-SHA256
      notNull: true,
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true,
    },
    attempts: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    max_attempts: {
      type: 'integer',
      notNull: true,
      default: 5,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    // Set when the code was successfully used.
    used_at: {
      type: 'timestamptz',
    },
    // Set when the code was superseded by a resend, locked out by too many
    // wrong attempts, found expired, or the email got verified another way.
    invalidated_at: {
      type: 'timestamptz',
    },
  });

  pgm.addConstraint('email_verification_codes', 'email_verification_codes_attempts_check', {
    check: 'attempts >= 0 AND max_attempts > 0',
  });

  pgm.createIndex('email_verification_codes', 'user_id');
  pgm.createIndex('email_verification_codes', 'expires_at'); // cleanup scans

  // At most ONE active (unused, not invalidated) code per user, enforced by
  // the database itself — not just application logic.
  pgm.createIndex('email_verification_codes', 'user_id', {
    name: 'email_verification_codes_one_active_per_user',
    unique: true,
    where: 'used_at IS NULL AND invalidated_at IS NULL',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('email_verification_codes');
  pgm.dropColumns('users', ['email_verified', 'email_verified_at']);
};
