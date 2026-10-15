const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');
const { findById } = require('../models/user.model');

/**
 * Protects a route: requires a valid access token in the
 * `Authorization: Bearer <token>` header.
 *
 * On success, attaches the current user's DB record (minus password_hash)
 * to req.user so downstream controllers/middleware can use it.
 *
 * We re-fetch the user from the database on every request (rather than
 * trusting the JWT payload alone) so that if an account is deactivated,
 * access is revoked immediately instead of waiting for the token to expire.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new ApiError(401, 'Authentication token missing');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      throw new ApiError(401, 'Invalid or expired token');
    }

    const user = await findById(payload.sub);

    if (!user) {
      throw new ApiError(401, 'User no longer exists');
    }

    if (!user.is_active) {
      throw new ApiError(403, 'This account has been deactivated');
    }

    // Phase 15: defense in depth — even a still-unexpired access token
    // (e.g. issued before this phase) can't reach protected APIs while the
    // account's email is unverified. The database is the source of truth.
    if (!user.email_verified) {
      throw new ApiError(403, 'Email verification required', null, 'EMAIL_NOT_VERIFIED');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authenticate;
