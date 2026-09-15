const express = require('express');
const registrationController = require('../controllers/registration.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { checkInSchema } = require('../validators/attendance.validator');
const { checkInRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Every route in this file requires SOME logged-in user — but not all of
// them are for the same role, so authorize() is applied per-route below
// rather than as a single blanket rule.
router.use(authenticate);

// --- Employee-only: registering for / managing their own registrations ---
router.post(
  '/events/:eventId/register',
  authorize('employee'),
  registrationController.register
);
router.get(
  '/events/:eventId/registration',
  authorize('employee'),
  registrationController.getMyRegistrationForEvent
);
router.get('/my-registrations', authorize('employee'), registrationController.listMyRegistrations);
router.delete(
  '/registrations/:id',
  authorize('employee'),
  registrationController.cancelRegistration
);
router.get('/registrations/:id/qr', authorize('employee'), registrationController.getQrCode);

// --- Admin-only: scanning a QR and marking attendance ---
// An employee hitting this endpoint gets 403, the same way an admin
// hitting an employee-only route above would.
router.post(
  '/registrations/check-in',
  authorize('admin'),
  checkInRateLimiter,
  validate(checkInSchema),
  registrationController.checkIn
);

module.exports = router;
