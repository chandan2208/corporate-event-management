const ApiError = require('../utils/ApiError');
const {
  generateVerificationCode,
  hashVerificationCode,
  verificationCodeMatches,
  maskEmail,
} = require('../utils/verificationCode');
const verificationModel = require('../models/emailVerification.model');
const userModel = require('../models/user.model');
const emailService = require('./email.service');

/**
 * Phase 15 — email verification business logic.
 *
 * The database is the single source of truth: whether a user is verified,
 * which code is active, how many attempts it has left and when it expires
 * are all read from PostgreSQL inside a transaction that holds a row lock
 * on the user. Nothing the frontend says about verification is trusted.
 */

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

const GENERIC_RESEND_MESSAGE = 'If the account requires verification, a new code has been sent.';

// ---------------------------------------------------------------------------
// Per-email resend cooldown (in-memory, applied to EVERY email address —
// existing or not — so a 429 here never reveals whether an account exists).
// The database check inside resendVerification() is the authoritative,
// restart-proof cooldown for real accounts; this map makes the response
// uniform for unknown addresses. Same single-instance limitation as the
// Phase 12 in-memory rate limiter (documented in README).
// ---------------------------------------------------------------------------
const cooldowns = new Map(); // email -> timestamp (ms) of last accepted request

const pruneCooldowns = (now) => {
  if (cooldowns.size < 5000) return;
  for (const [key, ts] of cooldowns) {
    if (now - ts >= RESEND_COOLDOWN_SECONDS * 1000) cooldowns.delete(key);
  }
};

const cooldownRemainingSeconds = (email, now = Date.now()) => {
  const last = cooldowns.get(email);
  if (!last) return 0;
  const remainingMs = RESEND_COOLDOWN_SECONDS * 1000 - (now - last);
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
};

const startCooldown = (email) => {
  const now = Date.now();
  pruneCooldowns(now);
  cooldowns.set(email, now);
};

const clearCooldown = (email) => cooldowns.delete(email);

const cooldownError = (seconds) => {
  const err = new ApiError(
    429,
    `Please wait ${seconds} seconds before requesting another code.`,
    null,
    'RESEND_COOLDOWN'
  );
  err.retryAfterSeconds = seconds;
  return err;
};

// ---------------------------------------------------------------------------
// Code issue + delivery
// ---------------------------------------------------------------------------

/**
 * Issues a fresh code for `userId` INSIDE the caller's transaction:
 * invalidates any previously active code, stores only the HMAC of the new
 * one, and returns the raw code to the caller so it can be emailed after
 * the transaction commits. The raw code is never persisted or logged.
 */
const issueCodeInTransaction = async (client, userId) => {
  const code = generateVerificationCode();
  await verificationModel.invalidateActiveCodes(client, userId);
  const row = await verificationModel.insertCode(client, {
    userId,
    codeHash: hashVerificationCode(userId, code),
    ttlMinutes: CODE_TTL_MINUTES,
    maxAttempts: MAX_ATTEMPTS,
  });
  return { code, codeId: row.id };
};

/**
 * Emails the code. On failure: deletes the undeliverable code row and
 * clears the cooldown (so the user can immediately request a new one once
 * delivery works again), logs a sanitized one-liner, and returns false.
 */
const deliverCode = async ({ user, code, codeId }) => {
  try {
    await emailService.sendVerificationEmail({
      to: user.email,
      name: user.name,
      code,
      expiresInMinutes: CODE_TTL_MINUTES,
    });
    return true;
  } catch (err) {
    console.error(
      `[email-verification] delivery failed for ${maskEmail(user.email)}: ${err.message} [${err.code || 'unknown'}]`
    );
    try {
      await verificationModel.deleteCodeById(codeId);
    } catch (cleanupErr) {
      console.error('[email-verification] could not remove undelivered code row:', cleanupErr.message);
    }
    clearCooldown(user.email);
    return false;
  }
};

// ---------------------------------------------------------------------------
// Registration hook (called from auth.service.register)
// ---------------------------------------------------------------------------

/**
 * Creates the employee account and its first verification code in ONE
 * transaction (so there's never an account row without a code, or a code
 * without an account), then sends the email after commit.
 *
 * If the email can't be sent, the account deliberately remains as a
 * pending (unverified) account rather than being rolled back: the email
 * address stays reserved for its owner (no duplicate accounts can ever be
 * created — `users.email` is UNIQUE), and the user simply presses "Resend
 * code" once delivery works. The response tells the frontend whether the
 * email went out.
 */
const createPendingAccount = async (userFields) => {
  let created;
  try {
    created = await verificationModel.withTransaction(async (client) => {
      const user = await userModel.createUser({ ...userFields, emailVerified: false }, client);
      const { code, codeId } = await issueCodeInTransaction(client, user.id);
      return { user, code, codeId };
    });
  } catch (err) {
    // Two simultaneous registrations for the same email: the loser hits the
    // UNIQUE constraint. Report it exactly like the pre-check does.
    if (err.code === '23505') {
      throw new ApiError(409, 'An account with this email already exists');
    }
    throw err;
  }

  startCooldown(created.user.email);
  const emailSent = await deliverCode(created);

  return {
    email: maskEmail(created.user.email),
    emailSent,
    verificationRequired: true,
    codeExpiresInMinutes: CODE_TTL_MINUTES,
    resendCooldownSeconds: emailSent ? RESEND_COOLDOWN_SECONDS : 0,
  };
};

// ---------------------------------------------------------------------------
// POST /api/auth/verify-email
// ---------------------------------------------------------------------------

const INVALID_CODE_MESSAGE = 'Invalid or expired verification code.';

const verifyEmail = async ({ email, code }) => {
  const user = await userModel.findByEmail(email);

  // Unknown or deactivated account: identical response to a wrong code.
  if (!user || !user.is_active) {
    throw new ApiError(401, INVALID_CODE_MESSAGE, null, 'INVALID_CODE');
  }

  if (user.email_verified) {
    throw new ApiError(409, 'This email address is already verified. Please sign in.', null, 'ALREADY_VERIFIED');
  }

  // The transaction returns an outcome instead of throwing, so that a
  // failed attempt's counter increment is COMMITTED (a throw would roll it
  // back and make the 5-attempt limit meaningless).
  const outcome = await verificationModel.withTransaction(async (client) => {
    const locked = await verificationModel.lockUserForVerification(client, user.id);
    if (!locked || !locked.is_active) return { status: 'invalid' };
    if (locked.email_verified) return { status: 'already' };

    const active = await verificationModel.findActiveCodeForUpdate(client, user.id);
    if (!active) return { status: 'invalid' };

    if (active.is_expired) {
      await verificationModel.invalidateCode(client, active.id);
      return { status: 'expired' };
    }

    if (!verificationCodeMatches(user.id, code, active.code_hash)) {
      const attempt = await verificationModel.recordFailedAttempt(client, active.id);
      return { status: attempt.locked ? 'locked' : 'invalid' };
    }

    await verificationModel.markCodeUsed(client, active.id);
    await verificationModel.invalidateActiveCodes(client, user.id);
    const verifiedUser = await userModel.markEmailVerified(client, user.id);
    return { status: 'verified', user: verifiedUser };
  });

  switch (outcome.status) {
    case 'verified':
      clearCooldown(user.email);
      return { email: maskEmail(outcome.user.email), emailVerified: true };
    case 'already':
      throw new ApiError(409, 'This email address is already verified. Please sign in.', null, 'ALREADY_VERIFIED');
    case 'expired':
      throw new ApiError(
        401,
        'This verification code has expired. Please request a new code.',
        null,
        'CODE_EXPIRED'
      );
    case 'locked':
      throw new ApiError(
        429,
        'Too many incorrect attempts. Please request a new verification code.',
        null,
        'TOO_MANY_ATTEMPTS'
      );
    default:
      throw new ApiError(401, INVALID_CODE_MESSAGE, null, 'INVALID_CODE');
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/resend-verification
// ---------------------------------------------------------------------------

/**
 * Always answers with the same generic message for unknown, deactivated
 * and already-verified addresses (no account enumeration). Email delivery
 * happens in the background after the response, so response timing
 * doesn't reveal whether an email was actually sent either.
 */
const resendVerification = async ({ email }) => {
  const remaining = cooldownRemainingSeconds(email);
  if (remaining > 0) throw cooldownError(remaining);
  startCooldown(email);

  const user = await userModel.findByEmail(email);
  if (!user || !user.is_active || user.email_verified) {
    return { message: GENERIC_RESEND_MESSAGE };
  }

  const issued = await verificationModel.withTransaction(async (client) => {
    const locked = await verificationModel.lockUserForVerification(client, user.id);
    if (!locked || !locked.is_active || locked.email_verified) return { status: 'skip' };

    // Authoritative, restart-proof cooldown from the database.
    const age = await verificationModel.secondsSinceLastCode(client, user.id);
    if (age !== null && age < RESEND_COOLDOWN_SECONDS) {
      return { status: 'cooldown', remaining: Math.ceil(RESEND_COOLDOWN_SECONDS - age) };
    }

    const { code, codeId } = await issueCodeInTransaction(client, user.id);
    return { status: 'issued', code, codeId };
  });

  if (issued.status === 'cooldown') throw cooldownError(issued.remaining);

  if (issued.status === 'issued') {
    deliverCode({ user: deliveryFields(user), code: issued.code, codeId: issued.codeId }).catch(() => {});
  }

  return { message: GENERIC_RESEND_MESSAGE };
};

// Only the fields deliverCode needs — keeps password_hash etc. out of the
// background task's closure.
const deliveryFields = (user) => ({ email: user.email, name: user.name });

const cleanupStaleCodes = (retentionHours) => verificationModel.deleteStaleCodes(retentionHours);

module.exports = {
  CODE_TTL_MINUTES,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
  GENERIC_RESEND_MESSAGE,
  createPendingAccount,
  verifyEmail,
  resendVerification,
  cleanupStaleCodes,
};
