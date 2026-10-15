/**
 * Phase 15 — trusted operator path: mark ONE account's email as verified
 * without a code. Like seed:admin, this is a command-line script only
 * (never an API endpoint), for someone with direct server/environment
 * access — e.g. an existing employee whose mailbox can't receive the code.
 *
 * It changes ONLY email_verified/email_verified_at. Name, email, password,
 * role, department/designation and all related data are untouched.
 *
 * Run with: npm run verify:user -- someone@example.com
 */

require('dotenv').config();

const { pool, withTransaction } = require('../config/db');
const userModel = require('../models/user.model');
const verificationModel = require('../models/emailVerification.model');

const run = async () => {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    console.error('Usage: npm run verify:user -- <email>');
    process.exit(1);
  }

  const user = await userModel.findByEmail(email);
  if (!user) {
    console.error(`No account found for "${email}".`);
    await pool.end();
    process.exit(1);
  }

  if (user.email_verified) {
    console.log(`"${email}" is already verified. Nothing to do.`);
    await pool.end();
    return;
  }

  await withTransaction(async (client) => {
    await verificationModel.invalidateActiveCodes(client, user.id);
    await userModel.markEmailVerified(client, user.id);
  });

  console.log(`Marked "${email}" (role: ${user.role}) as email-verified.`);
  await pool.end();
};

run().catch((err) => {
  console.error('Failed to verify account:', err.message);
  process.exit(1);
});
