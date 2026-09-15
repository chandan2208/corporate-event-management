const ApiError = require('../utils/ApiError');

/**
 * Restricts a route to specific roles. Must run AFTER `authenticate`
 * middleware, since it reads req.user set by that step.
 *
 * Usage: router.post('/events', authenticate, authorize('admin'), controller)
 *
 * This is the backend enforcement the architecture calls for — the
 * frontend may also hide admin-only buttons from employees, but that's
 * just UX. This middleware is what actually prevents an employee from
 * calling an admin API directly (e.g. via curl/Postman).
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(
      new ApiError(403, 'You do not have permission to perform this action')
    );
  }

  next();
};

module.exports = authorize;
