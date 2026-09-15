const jwt = require('jsonwebtoken');

/**
 * Two different secrets/tokens are used on purpose:
 *
 * - ACCESS token: short-lived (default 15m), sent in the Authorization
 *   header on every request, kept in memory on the frontend (never
 *   localStorage, to reduce XSS token-theft risk).
 * - REFRESH token: long-lived (default 7d), stored in an httpOnly cookie
 *   the browser sends automatically. It can only be used to obtain a new
 *   access token — it is never accepted by protected business APIs.
 *
 * Using two secrets means a leaked access-token secret can't be used to
 * forge refresh tokens and vice versa.
 */

const signAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
};

const signRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
