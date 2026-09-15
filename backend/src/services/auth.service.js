const ApiError = require('../utils/ApiError');
const { hashPassword, comparePassword } = require('../utils/password');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require('../utils/jwt');
const userModel = require('../models/user.model');

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
  createdAt: user.created_at,
});

/**
 * Public self-registration. Always creates an EMPLOYEE — the `role` field
 * is never read from the request body, so there's no way for a client to
 * register themselves as an admin through this endpoint.
 */
const register = async ({ name, email, password, employeeCode, department, designation }) => {
  const existing = await userModel.findByEmail(email);
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);

  const user = await userModel.createUser({
    name,
    email,
    passwordHash,
    role: 'employee',
    employeeCode,
    department,
    designation,
  });

  const tokens = buildTokens(user);
  return { user: toPublicUser(user), ...tokens };
};

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

  const tokens = buildTokens(user);
  return { user: toPublicUser(user), ...tokens };
};

module.exports = { register, login, getCurrentUser, refreshAccessToken };
