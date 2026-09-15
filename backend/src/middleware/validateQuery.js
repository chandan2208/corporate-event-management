const ApiError = require('../utils/ApiError');

/**
 * Same purpose as the existing `validate` middleware (Phase 2), but
 * targets `req.query` instead of `req.body`. Added as a NEW file rather
 * than modifying validate.js, so there is zero risk of changing behavior
 * for any of the many existing routes that already depend on that file
 * validating request bodies.
 *
 * IMPORTANT (found during Phase 11 testing): this project runs Express 5,
 * where `req.query` is a getter-only property that recomputes a fresh
 * object straight from the URL on every access — it has no mutable
 * backing store. Both `req.query = result.data` (silently a no-op) and
 * `Object.assign(req.query, result.data)` (mutates a throwaway object
 * that's discarded on the next access) were tried and confirmed NOT to
 * persist the validated/defaulted values. The fix is to attach the
 * validated result to a separate property, `req.validatedQuery`, which
 * controllers read from instead of `req.query`.
 */
const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return next(new ApiError(400, 'Invalid query parameters', details));
  }

  req.validatedQuery = result.data;
  next();
};

module.exports = validateQuery;
