const { z } = require('zod');

/**
 * Validates the two optional query filters. SQL injection is already
 * structurally impossible (every query is parameterized), but we still
 * validate strictly: an invalid `days` value should never silently
 * become NaN/Invalid Date inside a date calculation, and `status` must
 * be one of the real event_status enum values, not any arbitrary string.
 */
const dashboardQuerySchema = z.object({
  days: z.coerce
    .number({ message: 'days must be a number' })
    .int('days must be a whole number')
    .min(1, 'days must be at least 1')
    .max(365, 'days must be at most 365')
    .optional()
    .default(30),
  status: z
    .enum(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'], {
      message: 'status must be one of DRAFT, PUBLISHED, CANCELLED, COMPLETED',
    })
    .optional(),
});

module.exports = { dashboardQuerySchema };
