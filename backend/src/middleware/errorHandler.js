/**
 * Centralized error handler.
 *
 * Express recognizes this as an "error-handling middleware" because it takes
 * 4 arguments (err, req, res, next). Any error thrown or passed to next(err)
 * anywhere in the app ends up here, so we have ONE place that decides how
 * errors look to the client, instead of scattering try/catch response logic
 * across every controller.
 */

// eslint-disable-next-line no-unused-vars
/**
 * Phase 15: body-parser rejects malformed JSON (400) and over-limit bodies
 * (413) with `expose: true` errors. Previously these reached the client as
 * the right status but with the generic 'Internal server error' text; they
 * now get an accurate, still-generic message. Nothing from the parser's
 * own error text (which can echo input) is returned.
 */
const BODY_PARSER_MESSAGES = {
  'entity.parse.failed': 'Malformed JSON request body',
  'entity.too.large': 'Request payload too large',
};

const errorHandler = (err, req, res, next) => {
  const parserMessage = err.expose && BODY_PARSER_MESSAGES[err.type];
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : parserMessage || 'Internal server error';

  // Full error is always logged on the server for debugging,
  // even if we hide details from the client in production.
  console.error(`[ERROR] ${req.method} ${req.originalUrl} ->`, err);

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
      ...(err.details && { details: err.details }),
      // Only our own ApiError codes — never driver codes like pg's '23505'.
      ...(err.isOperational && err.code && { code: err.code }),
      // Phase 15: also in the body because browsers hide the Retry-After
      // header from cross-origin JS unless CORS explicitly exposes it.
      ...(err.isOperational && err.retryAfterSeconds && { retryAfterSeconds: err.retryAfterSeconds }),
    },
  });
};

/**
 * Catches requests to routes that don't exist (e.g. GET /api/unknown-route)
 * and forwards a clean 404 into the error handler above, instead of Express's
 * default HTML error page.
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
};

module.exports = { errorHandler, notFoundHandler };
