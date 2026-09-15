const ApiError = require('../utils/ApiError');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that a route param looks like a UUID BEFORE any model/service
 * code touches the database with it. Without this, a malformed id (e.g.
 * someone fuzzing `/api/events/not-a-real-id/speakers`) would reach
 * PostgreSQL and come back as a raw "invalid input syntax for type uuid"
 * error — surfaced as an opaque 500 by the generic error handler, and
 * indistinguishable from a real server problem. A clean 400 here is both
 * more correct (the request itself was malformed) and safer (no internal
 * error detail leaks to the client).
 *
 * This is a new, additive piece of middleware — it doesn't modify any
 * existing Phase 1–6 route or model file.
 */
const validateUuidParam = (paramName) => (req, res, next) => {
  const value = req.params[paramName];
  if (!UUID_REGEX.test(value)) {
    return next(new ApiError(400, `Invalid ${paramName}: must be a valid UUID`));
  }
  next();
};

module.exports = validateUuidParam;
