const ApiError = require('../utils/ApiError');
const scheduleModel = require('../models/schedule.model');
const speakerModel = require('../models/speaker.model');
const eventModel = require('../models/event.model');
const { getVisibleEventOrThrow, assertEventModifiable } = require('../utils/eventAccess');
const { fullSessionStateSchema, mapZodIssues } = require('../validators/schedule.validator');

const toPublicSession = (row) => ({
  id: row.id,
  eventId: row.event_id,
  title: row.title,
  description: row.description,
  speakerId: row.speaker_id,
  speakerName: row.speaker_name || null,
  speakerCompany: row.speaker_company || null,
  speakerDesignation: row.speaker_designation || null,
  startTime: row.start_time,
  endTime: row.end_time,
  location: row.location,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Cross-reference checks that need a database lookup, so they can't live
 * in the (synchronous) Zod schema:
 *   1. If a speakerId is given, that speaker must actually belong to THIS
 *      event — otherwise an admin could attach "Jane from Event A" onto a
 *      session in Event B, which would be a malformed/meaningless
 *      reference.
 *   2. The session's start/end time must fall within the event's own
 *      start/end time — a session can't happen before the event opens or
 *      after it closes. Both are TIME-only columns (see the migration),
 *      so this is a same-day time-of-day comparison.
 */
const assertSpeakerBelongsToEvent = async (speakerId, eventId) => {
  if (!speakerId) return;
  const speaker = await speakerModel.findById(speakerId);
  if (!speaker) {
    throw new ApiError(400, 'speakerId does not refer to an existing speaker');
  }
  if (speaker.event_id !== eventId) {
    throw new ApiError(400, 'That speaker belongs to a different event');
  }
};

const assertWithinEventHours = (startTime, endTime, event) => {
  // event.start_time/end_time come back from PostgreSQL as "HH:MM:SS"
  // strings, while the validated startTime/endTime here are always
  // "HH:MM" (5 chars, no seconds — see the TIME_REGEX in
  // schedule.validator.js). Comparing them as-is would be WRONG: JS
  // string comparison treats "09:00" as less than "09:00:00" (a shorter
  // string that's a prefix of a longer one sorts first), even though they
  // represent the identical time — which would incorrectly reject a
  // session that starts exactly when the event does. Both sides are
  // normalized to "HH:MM" first so the comparison is a fair, same-format
  // one.
  const eventStart = event.start_time.slice(0, 5);
  const eventEnd = event.end_time.slice(0, 5);

  if (startTime < eventStart || endTime > eventEnd) {
    throw new ApiError(
      400,
      `Session time must fall within the event's own hours (${eventStart}–${eventEnd})`
    );
  }
};

const createSession = async (eventId, data) => {
  const event = await eventModel.findById(eventId);
  if (!event) {
    throw new ApiError(404, 'Event not found');
  }
  assertEventModifiable(event, 'the schedule');

  await assertSpeakerBelongsToEvent(data.speakerId, eventId);
  assertWithinEventHours(data.startTime, data.endTime, event);

  const session = await scheduleModel.createSession(eventId, data);
  return toPublicSession(session);
};

const listSessionsForEvent = async (eventId, requestingRole) => {
  await getVisibleEventOrThrow(eventId, requestingRole);
  const sessions = await scheduleModel.listByEvent(eventId);
  return sessions.map(toPublicSession);
};

/**
 * Same lesson as Phase 3's event-update hardening fix: a partial patch
 * (e.g. "just change startTime") is merged onto the EXISTING session
 * first, then the whole resulting session is validated — both against
 * the format schema (end > start) and the cross-reference rules (speaker
 * still belongs to this event, times still within event hours) — before
 * anything is saved. This is what stops "update only startTime" from
 * silently producing a session that ends before it starts, or that spills
 * outside the event's hours because only one side of the window moved.
 */
const updateSession = async (sessionId, patch) => {
  const existing = await scheduleModel.findById(sessionId);
  if (!existing) {
    throw new ApiError(404, 'Session not found');
  }

  const event = await eventModel.findById(existing.event_id);
  assertEventModifiable(event, 'the schedule');

  const merged = {
    title: existing.title,
    description: existing.description,
    speakerId: existing.speaker_id,
    startTime: existing.start_time.slice(0, 5),
    endTime: existing.end_time.slice(0, 5),
    location: existing.location,
  };
  Object.entries(patch).forEach(([key, value]) => {
    if (value !== undefined) merged[key] = value;
  });

  const result = fullSessionStateSchema.safeParse(merged);
  if (!result.success) {
    throw new ApiError(400, 'Validation failed', mapZodIssues(result.error));
  }

  await assertSpeakerBelongsToEvent(merged.speakerId, existing.event_id);
  assertWithinEventHours(merged.startTime, merged.endTime, event);

  const updated = await scheduleModel.updateSession(sessionId, patch);
  return toPublicSession(updated);
};

const deleteSession = async (sessionId) => {
  const existing = await scheduleModel.findById(sessionId);
  if (!existing) {
    throw new ApiError(404, 'Session not found');
  }

  const event = await eventModel.findById(existing.event_id);
  assertEventModifiable(event, 'the schedule');

  await scheduleModel.deleteSession(sessionId);
};

module.exports = {
  createSession,
  listSessionsForEvent,
  updateSession,
  deleteSession,
};
