const express = require('express');
const certificateController = require('../controllers/certificate.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validateUuidParam = require('../middleware/validateUuidParam');
const { certificateRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * PUBLIC — no authenticate() at all. This must come before any blanket
 * auth middleware in this file (there is none here — auth is applied
 * per-route below, precisely so this one route can stay open).
 * Rate limited even though it's read-only: with no auth gate at all,
 * this is the one endpoint anyone on the internet can hit directly, so
 * it gets its own bound against scripted token-enumeration/DoS attempts
 * (tokens are 64 cryptographically random hex characters, so brute-force
 * guessing was already computationally infeasible — this is defense in
 * depth, not the primary protection).
 */
router.get(
  '/certificates/verify/:verificationToken',
  certificateRateLimiter,
  certificateController.verifyCertificate
);

// --- Employee-only ---
router.get(
  '/my-certificates',
  authenticate,
  authorize('employee'),
  certificateController.listMyCertificates
);
router.get(
  '/registrations/:registrationId/certificate',
  authenticate,
  authorize('employee'),
  validateUuidParam('registrationId'),
  certificateRateLimiter,
  certificateController.getOrCreateMyCertificate
);

// --- Shared (ownership OR admin, enforced inside the controller) ---
router.get(
  '/certificates/:certificateId/download',
  authenticate,
  validateUuidParam('certificateId'),
  certificateRateLimiter,
  certificateController.downloadCertificate
);

// --- Admin-only ---
router.get(
  '/admin/certificates',
  authenticate,
  authorize('admin'),
  certificateController.listAllCertificates
);
router.get(
  '/admin/certificates/:certificateId',
  authenticate,
  authorize('admin'),
  validateUuidParam('certificateId'),
  certificateController.getCertificateDetail
);
router.post(
  '/admin/registrations/:registrationId/certificate',
  authenticate,
  authorize('admin'),
  validateUuidParam('registrationId'),
  certificateRateLimiter,
  certificateController.adminGenerateCertificate
);
router.post(
  '/admin/certificates/:certificateId/revoke',
  authenticate,
  authorize('admin'),
  validateUuidParam('certificateId'),
  certificateController.revokeCertificate
);

module.exports = router;
