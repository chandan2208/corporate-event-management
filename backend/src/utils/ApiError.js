/**
 * Custom error class so that any part of the app (controllers, services)
 * can throw an error with a specific HTTP status code attached to it.
 *
 * Example usage (in a later phase):
 *   throw new ApiError(404, 'Event not found');
 */
class ApiError extends Error {
  /**
   * `code` (optional, Phase 15) is a stable machine-readable identifier the
   * frontend can branch on (e.g. 'EMAIL_NOT_VERIFIED') without parsing the
   * human-readable message.
   */
  constructor(statusCode, message, details = null, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
    this.isOperational = true; // marks this as a known/expected error

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
