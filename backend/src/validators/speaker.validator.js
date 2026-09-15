const { z } = require('zod');

const baseSpeakerFields = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(150),
  designation: z.string().trim().max(150).optional().nullable(),
  company: z.string().trim().max(150).optional().nullable(),
  bio: z.string().trim().max(3000).optional().nullable(),
  photoUrl: z
    .string()
    .trim()
    .url('Photo URL must be a valid URL')
    .max(2000)
    .optional()
    .nullable()
    .or(z.literal('')),
};

const createSpeakerSchema = z.object({
  name: baseSpeakerFields.name,
  designation: baseSpeakerFields.designation,
  company: baseSpeakerFields.company,
  bio: baseSpeakerFields.bio,
  photoUrl: baseSpeakerFields.photoUrl,
});

// All fields optional for partial updates — speaker fields don't have any
// cross-field rules among themselves (unlike events/sessions, a speaker's
// name/bio/company are independent of each other), so a straightforward
// partial schema is sufficient here — no merge-with-existing-row step
// needed the way event/session time updates require.
const updateSpeakerSchema = z.object({
  name: baseSpeakerFields.name.optional(),
  designation: baseSpeakerFields.designation,
  company: baseSpeakerFields.company,
  bio: baseSpeakerFields.bio,
  photoUrl: baseSpeakerFields.photoUrl,
});

module.exports = { createSpeakerSchema, updateSpeakerSchema };
