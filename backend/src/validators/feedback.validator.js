const { z } = require('zod');

/**
 * Rating: an integer 1-5. `.int()` rejects decimals (e.g. 3.5) on its
 * own — combined with min/max this rejects 0, negative numbers, 6+, and
 * non-integers, matching the spec exactly.
 */
const submitFeedbackSchema = z.object({
  rating: z
    .number({ message: 'Rating must be a number' })
    .int('Rating must be a whole number (no decimals)')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  comment: z.string().trim().max(2000, 'Comment must be under 2000 characters').optional().nullable(),
});

module.exports = { submitFeedbackSchema };
