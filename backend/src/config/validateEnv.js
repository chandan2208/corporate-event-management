/**
 * Validates that all environment variables the application actually
 * depends on are present before the server starts accepting traffic.
 *
 * This is a genuine Phase 14 gap fix: previously, a missing JWT_SECRET
 * (for example) wouldn't fail the server at startup — it would silently
 * start, then throw a confusing error deep inside jsonwebtoken the first
 * time someone tried to log in. Failing fast, with a clear message, at
 * process startup is much safer for a real deployment: a
 * misconfiguration is caught immediately by whatever is watching the
 * process (a container orchestrator, a process manager, a human running
 * `npm start`), not silently discovered by the first real user.
 *
 * Only variables the application genuinely reads elsewhere in the
 * codebase are listed here — nothing invented. Variables with sensible,
 * already-implemented defaults (PORT, rate limits, BCRYPT_SALT_ROUNDS)
 * are intentionally NOT required here, since the app already handles
 * their absence safely.
 */

const REQUIRED_VARS = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'CLIENT_URL'];

// The database can be configured EITHER by a single DATABASE_URL (preferred,
// see src/config/db.js) OR by the full set of discrete DB_* variables.
const DISCRETE_DB_VARS = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];

const isSet = (name) => Boolean(process.env[name]) && process.env[name].trim() !== '';

/**
 * Development-only fallback values that must NEVER silently carry over
 * into a production deployment. If NODE_ENV=production and one of these
 * exact placeholder values is still set, that's a real misconfiguration
 * (someone deployed with the example file untouched), not just a missing
 * variable, and startup should fail with a specific, actionable message.
 */
const KNOWN_PLACEHOLDER_VALUES = {
  JWT_SECRET: 'replace_this_with_a_long_random_string',
  JWT_REFRESH_SECRET: 'replace_this_with_another_long_random_string',
  DB_PASSWORD: 'your_db_password',
  DATABASE_URL: 'postgres://postgres:your_db_password@localhost:5432/corporate_event_db',
  ADMIN_PASSWORD: 'change_this_before_seeding',
};

/**
 * Phase 15: email delivery is required for new employees to verify their
 * accounts. In production a missing email configuration is a fatal
 * misconfiguration (every new registration would be stuck unverified). In
 * development it's a loud warning instead, so the rest of the app can
 * still be worked on without an SMTP server.
 */
const validateEmailConfig = () => {
  // Lazy require keeps this module dependency-free for every other check.
  const { getMissingEmailConfig } = require('../services/email.service');
  const missingEmail = getMissingEmailConfig();
  if (missingEmail.length === 0) return;

  if (process.env.NODE_ENV === 'production') {
    console.error('\nFATAL: email verification is enabled but email delivery is not configured:');
    missingEmail.forEach((name) => console.error(`  - ${name}`));
    console.error('\nSet these as environment variables (see .env.example). Refusing to start.\n');
    process.exit(1);
  }

  console.warn('\nWARNING: email delivery is not configured — verification codes cannot be sent.');
  missingEmail.forEach((name) => console.warn(`  - missing ${name}`));
  console.warn('New registrations will stay unverified until this is set (see .env.example).\n');
};

const validateEnv = () => {
  const missing = REQUIRED_VARS.filter((name) => !isSet(name));

  if (!isSet('DATABASE_URL')) {
    const missingDbVars = DISCRETE_DB_VARS.filter((name) => !isSet(name));
    if (missingDbVars.length > 0) {
      missing.push(`DATABASE_URL (or all of: ${DISCRETE_DB_VARS.join(', ')} — missing ${missingDbVars.join(', ')})`);
    }
  }

  if (missing.length > 0) {
    console.error('\nFATAL: missing required environment variable(s):');
    missing.forEach((name) => console.error(`  - ${name}`));
    console.error('\nSet these in your .env file (see .env.example) before starting the server.');
    console.error('Refusing to start with incomplete configuration.\n');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    const stillPlaceholder = Object.entries(KNOWN_PLACEHOLDER_VALUES).filter(
      ([name, placeholder]) => process.env[name] === placeholder
    );

    if (stillPlaceholder.length > 0) {
      console.error('\nFATAL: NODE_ENV=production but the following variable(s) still hold their');
      console.error('development placeholder value from .env.example:');
      stillPlaceholder.forEach(([name]) => console.error(`  - ${name}`));
      console.error('\nA real production secret/password must be set. Refusing to start.\n');
      process.exit(1);
    }
  }

  validateEmailConfig();
};

module.exports = validateEnv;
