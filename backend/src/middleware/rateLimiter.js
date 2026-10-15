const rateLimit = require('express-rate-limit');

/**
 * Factory for building rate limiters with sensible, environment-driven
 * defaults. Each sensitive endpoint gets its own limiter instance (a
 * brute-force attempt on login shouldn't also throttle a legitimate
 * admin scanning QR codes at the door, and vice versa).
 *
 * KNOWN PRODUCTION LIMITATION (Phase 12 audit): express-rate-limit's
 * default store is IN-MEMORY, per Node process. This is fine for this
 * project's current single-instance deployment model, but it does NOT
 * provide distributed rate limiting: if the app were ever scaled
 * horizontally (multiple processes/containers behind a load balancer),
 * each instance would track its own counters independently, so the
 * effective limit becomes (configured limit × instance count) rather
 * than a true global limit. Fixing this properly requires a shared store
 * (e.g. Redis via `rate-limit-redis`), which is a real infrastructure
 * dependency this project does not currently have — introducing it here
 * would be a significant, out-of-scope infrastructure change for a
 * hardening pass. This limitation is deliberately documented rather than
 * silently accepted or falsely presented as production-scale-safe.
 */
const createRateLimiter = ({ windowMs, limit, message, keyGenerator }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    ...(keyGenerator && { keyGenerator }),
    message: {
      success: false,
      error: {
        message: message || 'Too many attempts. Please try again later.',
        code: 'RATE_LIMITED',
      },
    },
  });

const minutes = (n) => n * 60 * 1000;

// Env-driven so limits can be tuned per environment without a code change.
const AUTH_LIMIT = parseInt(process.env.RATE_LIMIT_AUTH, 10) || 20;
const REFRESH_LIMIT = parseInt(process.env.RATE_LIMIT_REFRESH, 10) || 60;
const CHECKIN_LIMIT = parseInt(process.env.RATE_LIMIT_CHECKIN, 10) || 300;
const FEEDBACK_LIMIT = parseInt(process.env.RATE_LIMIT_FEEDBACK, 10) || 30;
const CERTIFICATE_LIMIT = parseInt(process.env.RATE_LIMIT_CERTIFICATE, 10) || 30;

/**
 * Login/register — 20 attempts per 15 min per IP by default. This is the
 * SAME instance/config used since Phase 2; existing behavior is
 * unchanged, only the construction mechanism was refactored.
 */
const authRateLimiter = createRateLimiter({
  windowMs: minutes(15),
  limit: AUTH_LIMIT,
  message: 'Too many attempts. Please try again later.',
});

/**
 * Refresh-token — higher limit than login (a legitimate single-page app
 * session may silently refresh many times over a workday), but still
 * bounded so a compromised/leaked refresh token can't be hammered
 * indefinitely from one IP.
 */
const refreshRateLimiter = createRateLimiter({
  windowMs: minutes(15),
  limit: REFRESH_LIMIT,
  message: 'Too many token refresh attempts. Please log in again.',
});

/**
 * Admin check-in scanning — deliberately generous. A real event check-in
 * desk may legitimately scan dozens of badges per minute during a rush;
 * this limit exists to catch runaway/scripted abuse, not normal use.
 */
const checkInRateLimiter = createRateLimiter({
  windowMs: minutes(15),
  limit: CHECKIN_LIMIT,
  message: 'Too many check-in attempts from this connection. Please slow down.',
});

/** Feedback submission — an employee only ever needs to submit once per
 * event (enforced by the unique constraint anyway); this just bounds
 * retry/scripted abuse. */
const feedbackRateLimiter = createRateLimiter({
  windowMs: minutes(15),
  limit: FEEDBACK_LIMIT,
  message: 'Too many feedback submissions. Please try again later.',
});

/** Certificate generation/download — bounded to prevent scripted mass
 * PDF-generation abuse (each request does real CPU work rendering a PDF). */
const certificateRateLimiter = createRateLimiter({
  windowMs: minutes(15),
  limit: CERTIFICATE_LIMIT,
  message: 'Too many certificate requests. Please try again later.',
});

// ---------------------------------------------------------------------------
// Phase 15 — email verification limiters.
//
// Each endpoint gets BOTH a per-IP limiter (runs first, before body
// validation) and a per-email limiter (runs after validation, keyed on the
// normalized email). The per-email limiter applies to every address
// whether or not an account exists, so hitting it reveals nothing.
// Same in-memory-store limitation as above.
// ---------------------------------------------------------------------------
const VERIFY_EMAIL_LIMIT = parseInt(process.env.RATE_LIMIT_VERIFY_EMAIL, 10) || 20;
const VERIFY_EMAIL_PER_EMAIL_LIMIT =
  parseInt(process.env.RATE_LIMIT_VERIFY_EMAIL_PER_EMAIL, 10) || 10;
const RESEND_VERIFICATION_LIMIT = parseInt(process.env.RATE_LIMIT_RESEND_VERIFICATION, 10) || 10;
const RESEND_VERIFICATION_PER_EMAIL_LIMIT =
  parseInt(process.env.RATE_LIMIT_RESEND_VERIFICATION_PER_EMAIL, 10) || 5;

const emailKey = (req) => `email:${typeof req.body?.email === 'string' ? req.body.email : ''}`;

/** POST /auth/verify-email — per IP, 15-minute window. */
const verifyEmailRateLimiter = createRateLimiter({
  windowMs: minutes(15),
  limit: VERIFY_EMAIL_LIMIT,
  message: 'Too many verification attempts. Please try again later.',
});

/** POST /auth/verify-email — per email address, 15-minute window. */
const verifyEmailPerEmailRateLimiter = createRateLimiter({
  windowMs: minutes(15),
  limit: VERIFY_EMAIL_PER_EMAIL_LIMIT,
  message: 'Too many verification attempts for this email. Please try again later.',
  keyGenerator: emailKey,
});

/** POST /auth/resend-verification — per IP, 15-minute window. */
const resendVerificationRateLimiter = createRateLimiter({
  windowMs: minutes(15),
  limit: RESEND_VERIFICATION_LIMIT,
  message: 'Too many code requests. Please try again later.',
});

/** POST /auth/resend-verification — per email address, 1-hour window. */
const resendVerificationPerEmailRateLimiter = createRateLimiter({
  windowMs: minutes(60),
  limit: RESEND_VERIFICATION_PER_EMAIL_LIMIT,
  message: 'Too many code requests for this email. Please try again later.',
  keyGenerator: emailKey,
});

module.exports = authRateLimiter;
module.exports.createRateLimiter = createRateLimiter;
module.exports.authRateLimiter = authRateLimiter;
module.exports.refreshRateLimiter = refreshRateLimiter;
module.exports.checkInRateLimiter = checkInRateLimiter;
module.exports.feedbackRateLimiter = feedbackRateLimiter;
module.exports.certificateRateLimiter = certificateRateLimiter;
module.exports.verifyEmailRateLimiter = verifyEmailRateLimiter;
module.exports.verifyEmailPerEmailRateLimiter = verifyEmailPerEmailRateLimiter;
module.exports.resendVerificationRateLimiter = resendVerificationRateLimiter;
module.exports.resendVerificationPerEmailRateLimiter = resendVerificationPerEmailRateLimiter;
