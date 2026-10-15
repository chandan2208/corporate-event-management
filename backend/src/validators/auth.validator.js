const { z } = require('zod');

/**
 * Employees self-register through this schema. Notice there is no `role`
 * field here at all — the backend hardcodes role = 'employee' for anyone
 * hitting this endpoint (see auth.service.js). This is what makes it
 * impossible to register as admin through this API, no matter what a
 * client sends.
 */
const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(150),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be under 72 characters') // bcrypt's hard limit
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  employeeCode: z.string().trim().max(50).optional(),
  department: z.string().trim().max(100).optional(),
  designation: z.string().trim().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Phase 15 schemas. `.strict()` rejects any unexpected keys, every field
 * must be a string (numbers/arrays/objects are rejected), and lengths are
 * bounded so oversized input never reaches the database.
 */
const verificationEmailField = z
  .string()
  .trim()
  .max(254, 'Email is too long')
  .toLowerCase()
  .email('Invalid email address');

const verifyEmailSchema = z
  .object({
    email: verificationEmailField,
    code: z.string().regex(/^\d{6}$/, 'Verification code must be exactly 6 digits'),
  })
  .strict();

const resendVerificationSchema = z
  .object({
    email: verificationEmailField,
  })
  .strict();

module.exports = { registerSchema, loginSchema, verifyEmailSchema, resendVerificationSchema };
