const ApiError = require('../utils/ApiError');

/**
 * Generic validation middleware factory.
 * Usage: router.post('/register', validate(registerSchema), controller)
 *
 * Runs the given Zod schema against req.body, replaces req.body with the
 * parsed/sanitized result (e.g. trimmed strings, lower-cased email) so
 * controllers always work with clean data, and turns validation failures
 * into a consistent 400 response instead of letting bad data reach the
 * database layer.
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return next(new ApiError(400, 'Validation failed', details));
  }

  req.body = result.data;
  next();
};

module.exports = validate;
