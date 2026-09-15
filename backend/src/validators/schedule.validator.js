const { z } = require('zod');

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM, 24-hour — same convention as event.validator.js

const baseSessionFields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().trim().max(3000).optional().nullable(),
  speakerId: z
    .string()
    .uuid('speakerId must be a valid UUID')
    .optional()
    .nullable(),
  startTime: z.string().regex(TIME_REGEX, 'Start time must be in HH:MM (24-hour) format'),
  endTime: z.string().regex(TIME_REGEX, 'End time must be in HH:MM (24-hour) format'),
  location: z.string().trim().max(150).optional().nullable(),
};

/**
 * The COMPLETE set of format/shape rules a session must satisfy — used
 * both for creation AND (merged with the existing row) for updates. See
 * schedule.service.js's updateSession, which learned from the Phase 3
 * partial-update bug: editing only `startTime` without re-sending
 * `endTime` must still be validated against the FINAL resulting session,
 * not just the one field that happened to be in the request.
 *
 * NOTE: this schema only checks end > start. It deliberately does NOT
 * check "session falls within the event's start/end time" or "speaker
 * belongs to this event" — those require a database lookup (the event's
 * hours, the speaker's event_id), which doesn't belong in a synchronous
 * Zod schema. Those two rules are enforced in schedule.service.js instead.
 */
const fullSessionStateSchema = z.object(baseSessionFields).refine(
  (data) => data.endTime > data.startTime,
  { message: 'End time must be after start time', path: ['endTime'] }
);

const createSessionSchema = fullSessionStateSchema;

// Partial for updates — same fast-fail-on-obviously-wrong-shape purpose
// as event.validator.js's updateEventSchema. The authoritative, whole-row
// check happens in the service layer via fullSessionStateSchema.
const updateSessionSchema = z
  .object({
    title: baseSessionFields.title.optional(),
    description: baseSessionFields.description,
    speakerId: baseSessionFields.speakerId,
    startTime: baseSessionFields.startTime.optional(),
    endTime: baseSessionFields.endTime.optional(),
    location: baseSessionFields.location,
  })
  .refine(
    (data) => data.startTime === undefined || data.endTime === undefined || data.endTime > data.startTime,
    { message: 'End time must be after start time', path: ['endTime'] }
  );

const mapZodIssues = (zodError) =>
  zodError.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));

module.exports = {
  createSessionSchema,
  updateSessionSchema,
  fullSessionStateSchema,
  mapZodIssues,
};
