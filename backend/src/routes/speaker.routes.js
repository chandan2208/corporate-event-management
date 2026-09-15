const express = require('express');
const speakerController = require('../controllers/speaker.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const validateUuidParam = require('../middleware/validateUuidParam');
const { createSpeakerSchema, updateSpeakerSchema } = require('../validators/speaker.validator');

const router = express.Router();

router.use(authenticate);

// Any logged-in user (admin or employee) can list — visibility rules
// (draft events hidden from employees) are enforced in the service layer.
router.get(
  '/events/:eventId/speakers',
  validateUuidParam('eventId'),
  speakerController.listSpeakers
);

// Admin-only mutations.
router.post(
  '/events/:eventId/speakers',
  validateUuidParam('eventId'),
  authorize('admin'),
  validate(createSpeakerSchema),
  speakerController.createSpeaker
);
router.put(
  '/speakers/:id',
  validateUuidParam('id'),
  authorize('admin'),
  validate(updateSpeakerSchema),
  speakerController.updateSpeaker
);
router.delete(
  '/speakers/:id',
  validateUuidParam('id'),
  authorize('admin'),
  speakerController.deleteSpeaker
);

module.exports = router;
