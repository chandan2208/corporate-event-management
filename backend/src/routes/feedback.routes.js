const express = require('express');
const feedbackController = require('../controllers/feedback.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const validateUuidParam = require('../middleware/validateUuidParam');
const { submitFeedbackSchema } = require('../validators/feedback.validator');
const { feedbackRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(authenticate);

// --- Employee-only: submitting and viewing their own feedback ---
router.post(
  '/events/:eventId/feedback',
  validateUuidParam('eventId'),
  authorize('employee'),
  feedbackRateLimiter,
  validate(submitFeedbackSchema),
  feedbackController.submitFeedback
);
router.get(
  '/events/:eventId/feedback/me',
  validateUuidParam('eventId'),
  authorize('employee'),
  feedbackController.getMyFeedback
);

// --- Admin-only: viewing all feedback for an event + summary stats ---
router.get(
  '/admin/events/:eventId/feedback',
  validateUuidParam('eventId'),
  authorize('admin'),
  feedbackController.listFeedbackForEvent
);
router.get(
  '/admin/events/:eventId/feedback/summary',
  validateUuidParam('eventId'),
  authorize('admin'),
  feedbackController.getFeedbackSummary
);

module.exports = router;
