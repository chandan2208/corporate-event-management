const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const limitBodySize = require('../middleware/limitBodySize');
const authRateLimiter = require('../middleware/rateLimiter');
const {
  refreshRateLimiter,
  verifyEmailRateLimiter,
  verifyEmailPerEmailRateLimiter,
  resendVerificationRateLimiter,
  resendVerificationPerEmailRateLimiter,
} = require('../middleware/rateLimiter');
const {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} = require('../validators/auth.validator');

const router = express.Router();

// Legitimate verify/resend bodies are well under 1 KB.
const SMALL_BODY_LIMIT = 2 * 1024;

// Public routes
router.post('/register', authRateLimiter, validate(registerSchema), authController.register);
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh-token', refreshRateLimiter, authController.refresh);
router.post('/logout', authController.logout);

// Phase 15 — email verification (public; order: per-IP limit -> size cap ->
// strict Zod validation -> per-email limit -> controller)
router.post(
  '/verify-email',
  verifyEmailRateLimiter,
  limitBodySize(SMALL_BODY_LIMIT),
  validate(verifyEmailSchema),
  verifyEmailPerEmailRateLimiter,
  authController.verifyEmail
);
router.post(
  '/resend-verification',
  resendVerificationRateLimiter,
  limitBodySize(SMALL_BODY_LIMIT),
  validate(resendVerificationSchema),
  resendVerificationPerEmailRateLimiter,
  authController.resendVerification
);

// Protected route — requires a valid access token
router.get('/me', authenticate, authController.me);

module.exports = router;
