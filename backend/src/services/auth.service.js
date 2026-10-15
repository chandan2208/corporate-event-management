const ApiError = require('../utils/ApiError');
const { hashPassword, comparePassword } = require('../utils/password');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require('../utils/jwt');
const userModel = require('../models/user.model');
const emailVerificationService = require('./emailVerification.service');

/**
 * Builds the token pair for a given user. `sub` (subject) is the standard
 * JWT claim name for "who this token is about" — we use the user's id.
 */
const buildTokens = (user) => {
  const payload = { sub: user.id, role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
};

/**
 * Strips password_hash (and anything else sensitive) before a user object
 * is ever sent back in an API response.
 */
const toPublicUser = (user) => ({
  id: user.id,
  employeeCode: user.employee_code,
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department,
  designation: user.designation,
  isActive: user.is_active,
  emailVerified: user.email_verified,
  createdAt: user.created_at,
});

/**
 * Public self-registration. Always creates an EMPLOYEE — the `role` field
 * is never read from the request body, so there's no way for a client to
 * register themselves as an admin through this endpoint.
 *
 * Phase 15: the account is created UNVERIFIED and a 6-digit code is
 * emailed. No access/refresh token is issued here any more — the user must
 * verify their email and then sign in with their password. Only safe,
 * non-identifying data (masked email, whether the email was sent) is
 * returned.
 */
const register = async ({ name, email, password, employeeCode, department, designation }) => {
  const existing = await userModel.findByEmail(email);
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);

  return emailVerificationService.createPendingAccount({
    name,
    email,
    passwordHash,
    role: 'employee',
    employeeCode,
    department,
    designation,
  });
};

const EMAIL_NOT_VERIFIED_MESSAGE = 'Please verify your email before signing in.';

/**
 * Shared login logic for BOTH admin and employee — role is determined by
 * what's stored in the database, not by which "login page" the request
 * came from. This is safer than having separate admin/employee login
 * endpoints that could be confused or spoofed.
 */
const login = async ({ email, password }) => {
  const user = await userModel.findByEmail(email);

  // Deliberately generic message: don't reveal whether the email exists or
  // the password was wrong — that distinction helps attackers enumerate
  // valid accounts.
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (!user.is_active) {
    throw new ApiError(403, 'This account has been deactivated');
  }

  const passwordMatches = await comparePassword(password, user.password_hash);
  if (!passwordMatches) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Phase 15: checked only AFTER the password matched, so this response
  // can't be used to probe which addresses have unverified accounts. No
  // token of any kind is issued for an unverified account.
  if (!user.email_verified) {
    throw new ApiError(403, EMAIL_NOT_VERIFIED_MESSAGE, null, 'EMAIL_NOT_VERIFIED');
  }

  const tokens = buildTokens(user);
  return { user: toPublicUser(user), ...tokens };
};

const getCurrentUser = async (userId) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return toPublicUser(user);
};

/**
 * Exchanges a valid refresh token (from the httpOnly cookie) for a brand
 * new access token, without requiring the user to log in again.
 */
const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new ApiError(401, 'Refresh token missing');
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const user = await userModel.findById(payload.sub);
  if (!user || !user.is_active) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  // Phase 15: a refresh token issued before this phase to a now-unverified
  // employee can't be used to keep a session alive.
  if (!user.email_verified) {
    throw new ApiError(403, EMAIL_NOT_VERIFIED_MESSAGE, null, 'EMAIL_NOT_VERIFIED');
  }

  const tokens = buildTokens(user);
  return { user: toPublicUser(user), ...tokens };
};

const verifyEmail = (payload) => emailVerificationService.verifyEmail(payload);
const resendVerification = (payload) => emailVerificationService.resendVerification(payload);

module.exports = {
  register,
  login,
  getCurrentUser,
  refreshAccessToken,
  verifyEmail,
  resendVerification,
};
