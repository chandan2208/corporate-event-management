const authService = require('../services/auth.service');

// Options for the httpOnly refresh-token cookie.
//
// PRODUCTION FIX (cross-origin Render deployment): the frontend
// (corporate-event-management-1.onrender.com) and backend
// (corporate-event-management.onrender.com) are on different
// *.onrender.com subdomains. Render's domain is on the public suffix
// list as a multi-tenant "private" domain (like github.io/vercel.app),
// so browsers correctly treat these two subdomains as different SITES,
// not the same site, even though they share the onrender.com apex.
// A `SameSite=Strict` (or Lax) cookie is never attached to a cross-site
// request AT ALL — not just cross-site navigation, but every XHR/fetch
// too — which is exactly why the refresh cookie never reached the
// backend in production ("Refresh token missing"). This was invisible
// locally because localhost:5173 and localhost:5000 are same-site
// (site identity ignores port), so `Strict` worked fine there.
//
// The fix: `sameSite: 'none'` in production, which is what a genuinely
// cross-origin cookie requires — paired with `secure: true` (the
// browser spec mandates Secure whenever SameSite=None; our existing
// `secure: NODE_ENV === 'production'` already happens to line up
// exactly with this requirement). Locally (NODE_ENV=development),
// `sameSite: 'strict'` is kept exactly as before — no change to local
// dev behavior. This does not weaken security: CORS still restricts
// requests to the exact configured CLIENT_URL with credentials, and
// SameSite=None only permits the browser to attach the cookie to
// requests actually addressed to our own backend origin — it does not
// expose the cookie to unrelated third-party sites.
const REFRESH_COOKIE_NAME = 'refreshToken';
const isProduction = process.env.NODE_ENV === 'production';
const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'strict',
  path: '/api/auth', // only sent back to auth endpoints, not every request
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches JWT_REFRESH_EXPIRES_IN default
};

/**
 * Phase 15: registration no longer signs the user in (no access token, no
 * refresh cookie). The account must verify its email first.
 */
const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);

    res.status(201).json({
      success: true,
      message: result.emailSent
        ? 'Registration successful. Please verify your email.'
        : 'Registration successful, but we could not send the verification email right now. Please request a new code.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const data = await authService.verifyEmail(req.body);
    res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now sign in.',
      data,
    });
  } catch (err) {
    next(err);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    const { message } = await authService.resendVerification(req.body);
    res.status(200).json({ success: true, message });
  } catch (err) {
    if (err.retryAfterSeconds) res.set('Retry-After', String(err.retryAfterSeconds));
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.login(req.body);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user, accessToken },
    });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    // req.user was already loaded by the `authenticate` middleware — no
    // extra work needed here, but we go through the service for a single
    // consistent "public user shape" used everywhere.
    const user = await authService.getCurrentUser(req.user.id);
    res.status(200).json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    const { user, accessToken, refreshToken } = await authService.refreshAccessToken(token);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);

    res.status(200).json({
      success: true,
      message: 'Token refreshed',
      data: { user, accessToken },
    });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res) => {
  // Clearing the cookie is the correct approach for a stateless-JWT setup
  // without a token blacklist: the refresh token technically remains valid
  // until it expires, but the browser will no longer send it, and the
  // short-lived access token expires on its own within minutes.
  //
  // Must pass the SAME path/sameSite/secure attributes used when the
  // cookie was set (maxAge/httpOnly aren't needed for clearing) — a
  // clearCookie call with mismatched attributes can fail to match the
  // actual cookie in some browsers, leaving it behind.
  res.clearCookie(REFRESH_COOKIE_NAME, {
    path: refreshCookieOptions.path,
    sameSite: refreshCookieOptions.sameSite,
    secure: refreshCookieOptions.secure,
  });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

module.exports = { register, login, me, refresh, logout, verifyEmail, resendVerification };
