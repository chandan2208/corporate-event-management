import axiosClient from './axiosClient';

/**
 * Admin-only check-in call. `token` here is the raw string decoded from
 * the scanned QR image — the frontend never has (or needs) the employee's
 * identity; the backend resolves everything from the token itself and
 * enforces admin authorization via the JWT, not anything in this body.
 */
export const checkInByToken = (token) =>
  axiosClient
    .post('/registrations/check-in', { token })
    .then((res) => res.data.data.registration);
