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

const REQUIRED_VARS = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'CLIENT_URL',
];

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
  ADMIN_PASSWORD: 'change_this_before_seeding',
};

const validateEnv = () => {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name] || process.env[name].trim() === '');

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
};

module.exports = validateEnv;
