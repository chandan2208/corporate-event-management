const { z } = require('zod');

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM, 24-hour

/**
 * Shared cross-field checks used by both create and update: end time after
 * start time (app-level check that mirrors the DB constraint — catching it
 * here gives a clean 400 with a helpful message instead of a raw DB error),
 * and the registration deadline must not be after the event itself starts.
 */
const addCrossFieldChecks = (schema) =>
  schema
    .refine((data) => data.startTime === undefined || data.endTime === undefined || data.endTime > data.startTime, {
      message: 'End time must be after start time',
      path: ['endTime'],
    })
    .refine(
      (data) => {
        if (!data.eventDate || !data.startTime || !data.registrationDeadline) return true;
        const eventStart = new Date(`${data.eventDate}T${data.startTime}:00`);
        const deadline = new Date(data.registrationDeadline);
        return deadline <= eventStart;
      },
      {
        message: 'Registration deadline must be on or before the event start time',
        path: ['registrationDeadline'],
      }
    );

const baseEventFields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  venue: z.string().trim().min(3, 'Venue must be at least 3 characters').max(200),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Event date must be in YYYY-MM-DD format'),
  startTime: z.string().regex(TIME_REGEX, 'Start time must be in HH:MM (24-hour) format'),
  endTime: z.string().regex(TIME_REGEX, 'End time must be in HH:MM (24-hour) format'),
  capacity: z
    .number({ message: 'Capacity must be a number' })
    .int('Capacity must be a whole number')
    .positive('Capacity must be greater than 0')
    .max(100000, 'Capacity is unrealistically large'),
  registrationDeadline: z
    .string()
    .refine((val) => !Number.isNaN(Date.parse(val)), 'Registration deadline must be a valid date/time'),
};

/**
 * The COMPLETE set of rules a valid event must satisfy, regardless of
 * whether we're creating a brand new event or validating the final,
 * merged state of an existing event after a partial update. Using the
 * exact same schema in both places is what prevents "update only one
 * field" from sneaking past checks that depend on other fields — see
 * event.service.js's updateEvent(), which merges the existing DB row with
 * the partial patch and re-validates the WHOLE thing against this schema
 * before saving anything.
 */
const fullEventStateSchema = addCrossFieldChecks(
  z.object(baseEventFields).refine((data) => new Date(data.eventDate) >= new Date(new Date().toDateString()), {
    message: 'Event date cannot be in the past',
    path: ['eventDate'],
  })
);

// Used at the route level purely as a fast, cheap first pass: rejects
// obviously malformed values (wrong types, bad formats) in whatever fields
// the client happened to send, before we even touch the database. It does
// NOT — and cannot — catch cross-field issues that depend on fields the
// client didn't send (e.g. changing only eventDate without resending
// registrationDeadline). That authoritative, whole-record check happens in
// the service layer against fullEventStateSchema.
const updateEventSchema = addCrossFieldChecks(
  z.object({
    title: baseEventFields.title.optional(),
    description: baseEventFields.description,
    venue: baseEventFields.venue.optional(),
    eventDate: baseEventFields.eventDate.optional(),
    startTime: baseEventFields.startTime.optional(),
    endTime: baseEventFields.endTime.optional(),
    capacity: baseEventFields.capacity.optional(),
    registrationDeadline: baseEventFields.registrationDeadline.optional(),
  })
);

const statusUpdateSchema = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'], {
    message: 'Status must be one of DRAFT, PUBLISHED, CANCELLED, COMPLETED',
  }),
});

/**
 * Converts a Zod SafeParseError into the same { field, message } shape the
 * `validate` middleware produces, so error responses look identical
 * whether the rejection happened at the route level or deep inside the
 * service layer during merged-state validation.
 */
const mapZodIssues = (zodError) =>
  zodError.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));

module.exports = {
  createEventSchema: fullEventStateSchema,
  fullEventStateSchema,
  updateEventSchema,
  statusUpdateSchema,
  mapZodIssues,
};
