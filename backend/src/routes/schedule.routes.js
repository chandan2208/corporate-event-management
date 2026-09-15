const express = require('express');
const scheduleController = require('../controllers/schedule.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const validateUuidParam = require('../middleware/validateUuidParam');
const { createSessionSchema, updateSessionSchema } = require('../validators/schedule.validator');

const router = express.Router();

router.use(authenticate);

router.get(
  '/events/:eventId/schedule',
  validateUuidParam('eventId'),
  scheduleController.listSessions
);

router.post(
  '/events/:eventId/schedule',
  validateUuidParam('eventId'),
  authorize('admin'),
  validate(createSessionSchema),
  scheduleController.createSession
);
router.put(
  '/schedule/:id',
  validateUuidParam('id'),
  authorize('admin'),
  validate(updateSessionSchema),
  scheduleController.updateSession
);
router.delete(
  '/schedule/:id',
  validateUuidParam('id'),
  authorize('admin'),
  scheduleController.deleteSession
);

module.exports = router;
