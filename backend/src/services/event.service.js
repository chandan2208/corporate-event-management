const ApiError = require('../utils/ApiError');
const eventModel = require('../models/event.model');
const { fullEventStateSchema, mapZodIssues } = require('../validators/event.validator');

/**
 * Explicit state machine for event status. Keeping this as a plain lookup
 * table (rather than scattered if/else checks) makes the allowed
 * transitions easy to see and easy to extend in later phases.
 *
 * PUBLISHED -> DRAFT is deliberately NOT allowed: once an event has been
 * published, employees may already be relying on it being real (browsing
 * it, and in later phases registering for it). Silently un-publishing it
 * back to an invisible draft would be confusing and could hide an event
 * someone already committed to. Cancelling is the correct way to stop a
 * published event from proceeding.
 */
const ALLOWED_TRANSITIONS = {
  DRAFT: ['PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['CANCELLED', 'COMPLETED'],
  CANCELLED: [], // terminal
  COMPLETED: [], // terminal
};

/**
 * Formats a DB row into the shape the API returns. Keeps snake_case
 * database columns internal — the frontend only ever sees camelCase.
 */
const toPublicEvent = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  venue: row.venue,
  eventDate: row.event_date,
  startTime: row.start_time,
  endTime: row.end_time,
  capacity: row.capacity,
  registrationDeadline: row.registration_deadline,
  status: row.status,
  createdBy: row.created_by,
  createdByName: row.created_by_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Converts a raw `events` DB row into the exact same camelCase string
 * shape that fullEventStateSchema (and the incoming request body) use.
 * This is what lets us merge "what's already saved" with "what the client
 * is changing" and validate the result as one consistent object.
 */
const toSchemaShape = (row) => ({
  title: row.title,
  description: row.description,
  venue: row.venue,
  eventDate: row.event_date.toISOString().slice(0, 10),
  startTime: row.start_time.slice(0, 5),
  endTime: row.end_time.slice(0, 5),
  capacity: row.capacity,
  registrationDeadline: row.registration_deadline.toISOString(),
});

/**
 * Merges the partial patch on top of the existing row's schema-shaped
 * values. Only keys the client actually sent (i.e. not `undefined`)
 * override the existing value — this is what makes a truly partial
 * update ("just change the capacity") still get checked against the
 * event's real, complete final state.
 */
const mergeForValidation = (existingRow, patch) => {
  const current = toSchemaShape(existingRow);
  const merged = { ...current };
  Object.entries(patch).forEach(([key, value]) => {
    if (value !== undefined) {
      merged[key] = value;
    }
  });
  return merged;
};

const createEvent = async (data, adminId) => {
  const event = await eventModel.createEvent(data, adminId);
  return toPublicEvent(event);
};

/**
 * Used by BOTH the admin and employee "get one event" endpoints, but with
 * different visibility rules depending on the caller's role:
 *   - admin: can see any event regardless of status
 *   - employee: can see PUBLISHED, CANCELLED, or COMPLETED events (so they
 *     can still check on an event they may have registered for even after
 *     it ends or gets cancelled), but never a DRAFT — drafts don't exist
 *     from an employee's point of view yet.
 */
const getEventById = async (id, requestingRole) => {
  const event = await eventModel.findById(id);

  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  if (requestingRole !== 'admin' && event.status === 'DRAFT') {
    // Deliberately the same 404 as "doesn't exist" — an employee shouldn't
    // be able to distinguish "no such event" from "exists but is a draft
    // you're not allowed to see".
    throw new ApiError(404, 'Event not found');
  }

  return toPublicEvent(event);
};

const listEventsForAdmin = async (filters) => {
  const { events, pagination } = await eventModel.listEvents(filters);
  return { events: events.map(toPublicEvent), pagination };
};

const listPublishedEventsForEmployee = async (filters) => {
  const { events, pagination } = await eventModel.listEvents({
    ...filters,
    status: 'PUBLISHED', // hard-enforced here — never taken from client input
  });
  return { events: events.map(toPublicEvent), pagination };
};

const updateEvent = async (id, data) => {
  const existing = await eventModel.findById(id);
  if (!existing) {
    throw new ApiError(404, 'Event not found');
  }

  if (['CANCELLED', 'COMPLETED'].includes(existing.status)) {
    throw new ApiError(
      409,
      `Cannot edit an event that is already ${existing.status.toLowerCase()}`
    );
  }

  // Authoritative validation: build what the event would look like AFTER
  // this patch is applied, and validate THAT whole object — not just the
  // handful of fields the client happened to send. This is what catches
  // e.g. "only eventDate was changed" bypassing the check that
  // registrationDeadline must still be before the (new) event start.
  const merged = mergeForValidation(existing, data);
  const result = fullEventStateSchema.safeParse(merged);

  if (!result.success) {
    throw new ApiError(400, 'Validation failed', mapZodIssues(result.error));
  }

  const updated = await eventModel.updateEvent(id, data);
  return toPublicEvent(updated);
};

const changeStatus = async (id, newStatus) => {
  const existing = await eventModel.findById(id);
  if (!existing) {
    throw new ApiError(404, 'Event not found');
  }

  const allowedNextStatuses = ALLOWED_TRANSITIONS[existing.status] || [];

  if (existing.status === newStatus) {
    throw new ApiError(409, `Event is already ${newStatus.toLowerCase()}`);
  }

  if (!allowedNextStatuses.includes(newStatus)) {
    throw new ApiError(
      409,
      `Cannot change status from ${existing.status} to ${newStatus}. ` +
        `Allowed next steps: ${allowedNextStatuses.join(', ') || 'none (final state)'}`
    );
  }

  const updated = await eventModel.updateStatus(id, newStatus);
  return toPublicEvent(updated);
};

/**
 * Hard delete is only ever allowed for DRAFT events — i.e. something an
 * admin created by mistake and never published. Once an event has been
 * published, deleting it outright would destroy a historical record that
 * employees may have registered against; the correct action at that point
 * is to CANCEL it (see changeStatus), which keeps the record but marks it
 * as no longer happening.
 */
const deleteEvent = async (id) => {
  const existing = await eventModel.findById(id);
  if (!existing) {
    throw new ApiError(404, 'Event not found');
  }

  if (existing.status !== 'DRAFT') {
    throw new ApiError(
      409,
      `Only draft events can be deleted. This event is ${existing.status.toLowerCase()} — cancel it instead.`
    );
  }

  await eventModel.deleteEvent(id);
};

module.exports = {
  createEvent,
  getEventById,
  listEventsForAdmin,
  listPublishedEventsForEmployee,
  updateEvent,
  changeStatus,
  deleteEvent,
};
