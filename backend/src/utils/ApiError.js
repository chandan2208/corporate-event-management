/**
 * Custom error class so that any part of the app (controllers, services)
 * can throw an error with a specific HTTP status code attached to it.
 *
 * Example usage (in a later phase):
 *   throw new ApiError(404, 'Event not found');
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // marks this as a known/expected error

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
