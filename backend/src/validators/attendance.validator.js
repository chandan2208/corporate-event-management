const { z } = require('zod');

/**
 * A registration token is always a 64-character lowercase hex string
 * (see utils/qrToken.js — 32 random bytes, hex-encoded). Validating the
 * SHAPE here, before any database lookup, means obviously-garbage input
 * (wrong length, non-hex characters, a JSON blob, someone pasting a whole
 * URL, etc.) gets a clean 400 immediately — it never reaches a SQL query,
 * and it never gets treated as "maybe this is a real token we just
 * haven't found yet" (which would otherwise be a 404, a subtly different
 * signal from "this was never a validly-shaped token to begin with").
 */
const checkInSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[0-9a-f]{64}$/i, 'Invalid token format'),
});

module.exports = { checkInSchema };
