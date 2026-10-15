/**
 * One-time script to create the initial admin account.
 *
 * This is intentionally a command-line script, NOT an API endpoint —
 * there is no `POST /api/auth/register-admin` anywhere in this app. That
 * is what "admin accounts must not be created through an unsafe public
 * registration endpoint" means in practice: the only way to create one is
 * for someone with direct access to the server/environment to run this
 * script.
 *
 * Run with: npm run seed:admin
 * Reads ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD from .env.
 */

require('dotenv').config();

const { hashPassword } = require('../utils/password');
const { registerSchema } = require('../validators/auth.validator');
const userModel = require('../models/user.model');
const { pool } = require('../config/db');

// The exact placeholder shipped in .env.example — never a real password.
const PLACEHOLDER_PASSWORD = 'change_this_before_seeding';

const run = async () => {
  const name = process.env.ADMIN_NAME?.trim();
  const rawEmail = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !rawEmail || !password) {
    console.error(
      'Missing ADMIN_NAME, ADMIN_EMAIL, or ADMIN_PASSWORD in .env — cannot seed admin.'
    );
    process.exit(1);
  }

  // Normalize exactly like the register/login validators do (trim +
  // lowercase). Without this, an ADMIN_EMAIL with any capital letter was
  // stored as-is, but login looks emails up lowercased — the admin could
  // never log in, and every later seed run hit a unique-violation.
  const emailCheck = registerSchema.shape.email.safeParse(rawEmail);
  if (!emailCheck.success) {
    console.error('ADMIN_EMAIL is not a valid email address.');
    process.exit(1);
  }
  const email = emailCheck.data;

  if (password === PLACEHOLDER_PASSWORD) {
    console.error('ADMIN_PASSWORD still holds the .env.example placeholder — set a real password.');
    process.exit(1);
  }

  // Same password policy every other account must meet.
  const passwordCheck = registerSchema.shape.password.safeParse(password);
  if (!passwordCheck.success) {
    console.error(`ADMIN_PASSWORD rejected: ${passwordCheck.error.issues.map((i) => i.message).join('; ')}`);
    process.exit(1);
  }

  const existing = await userModel.findByEmail(email);
  if (existing) {
    console.log(`An account with email "${email}" already exists (role: ${existing.role}).`);
    console.log('Nothing to do.');
    await pool.end();
    return;
  }

  const passwordHash = await hashPassword(password);

  const admin = await userModel.createUser({
    name,
    email,
    passwordHash,
    role: 'admin',
    // Phase 15: admins are created only by this trusted, server-side
    // script, never through public registration, so they're verified.
    emailVerified: true,
  });

  console.log('Admin account created successfully:');
  console.log(`  Name:  ${admin.name}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Role:  ${admin.role}`);
  console.log('You can now log in with this email and the password set in .env.');

  await pool.end();
};

run().catch((err) => {
  console.error('Failed to seed admin account:', err);
  process.exit(1);
});
