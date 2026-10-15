import axiosClient from './axiosClient';

/**
 * Thin wrappers around each auth endpoint. Feature code (AuthContext,
 * pages) calls these instead of using axiosClient directly, so the actual
 * URL paths and response shape only need to be known in one place.
 */

/**
 * Phase 15: registration no longer signs the user in. Resolves to
 * `{ message, data: { email (masked), emailSent, resendCooldownSeconds, ... } }`.
 */
export const registerRequest = (payload) =>
  axiosClient.post('/auth/register', payload).then((res) => res.data);

export const loginRequest = (payload) =>
  axiosClient.post('/auth/login', payload).then((res) => res.data.data);

export const meRequest = () => axiosClient.get('/auth/me').then((res) => res.data.data);

/**
 * Used once on app load to silently restore a session from the httpOnly
 * refresh-token cookie, without requiring the user to log in again after
 * a page refresh.
 */
export const refreshRequest = () =>
  axiosClient.post('/auth/refresh-token').then((res) => res.data.data);

export const logoutRequest = () => axiosClient.post('/auth/logout');

/** Phase 15 — submit the 6-digit code emailed at registration/resend. */
export const verifyEmailRequest = (payload) =>
  axiosClient.post('/auth/verify-email', payload).then((res) => res.data);

/** Phase 15 — request a new code (generic response; never reveals account state). */
export const resendVerificationRequest = (payload) =>
  axiosClient.post('/auth/resend-verification', payload).then((res) => res.data);
