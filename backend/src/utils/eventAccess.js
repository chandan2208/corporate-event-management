const ApiError = require('./ApiError');
const eventModel = require('../models/event.model');

const TERMINAL_STATUSES = ['CANCELLED', 'COMPLETED'];

/**
 * Shared by speaker.service.js and schedule.service.js: an employee can
 * only see a DRAFT event's speakers/schedule if the event itself would be
 * visible to them. Mirrors event.service.js's getEventById visibility
 * rule exactly, without modifying that file — this only ever READS the
 * event's status via the existing event model.
 */
const getVisibleEventOrThrow = async (eventId, requestingRole) => {
  const event = await eventModel.findById(eventId);

  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  if (requestingRole !== 'admin' && event.status === 'DRAFT') {
    // Same 404-not-403 reasoning used throughout the app: don't let an
    // employee distinguish "no such event" from "exists but is a draft".
    throw new ApiError(404, 'Event not found');
  }

  return event;
};

/**
 * Once an event is CANCELLED or COMPLETED, its speakers and schedule are
 * frozen — no create/update/delete. This mirrors the same terminal-state
 * rule event.service.js already applies to editing the event itself, so
 * the whole system agrees on what "terminal" means: nothing about a
 * finished or cancelled event changes after the fact.
 */
const assertEventModifiable = (event, resourceLabel) => {
  if (TERMINAL_STATUSES.includes(event.status)) {
    throw new ApiError(
      409,
      `Cannot modify ${resourceLabel} for an event that is already ${event.status.toLowerCase()}`
    );
  }
};

module.exports = { getVisibleEventOrThrow, assertEventModifiable };
