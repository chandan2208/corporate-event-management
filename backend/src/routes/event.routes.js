const express = require('express');
const eventController = require('../controllers/event.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
  createEventSchema,
  updateEventSchema,
  statusUpdateSchema,
} = require('../validators/event.validator');

const router = express.Router();

// Every event route requires SOME logged-in user — there is no public,
// unauthenticated event browsing in this system.
router.use(authenticate);

// GET /api/events — admin sees everything (with filters); employee sees
// only published events. Role branching happens inside the controller.
router.get('/', eventController.listEvents);

// GET /api/events/:id — visibility rules (draft vs published) enforced in
// the service layer, not here.
router.get('/:id', eventController.getEvent);

// Everything below this line is admin-only.
router.post('/', authorize('admin'), validate(createEventSchema), eventController.createEvent);
router.put(
  '/:id',
  authorize('admin'),
  validate(updateEventSchema),
  eventController.updateEvent
);
router.patch(
  '/:id/status',
  authorize('admin'),
  validate(statusUpdateSchema),
  eventController.changeStatus
);
router.delete('/:id', authorize('admin'), eventController.deleteEvent);

module.exports = router;
