const ApiError = require('../utils/ApiError');
const registrationModel = require('../models/registration.model');
const { findFirstAvailableSeat } = require('../utils/seatAllocation');
const { generateQrToken } = require('../utils/qrToken');
const { generateQrDataUrl } = require('./qr.service');

const toPublicRegistration = (row) => ({
  id: row.id,
  status: row.status,
  seatLabel: row.seat_label,
  qrToken: row.qr_token,
  registeredAt: row.registered_at,
  cancelledAt: row.cancelled_at,
  event: {
    id: row.event_id,
    title: row.event_title,
    venue: row.event_venue,
    eventDate: row.event_date,
    startTime: row.event_start_time,
    endTime: row.event_end_time,
    status: row.event_status,
  },
});

/**
 * The core concurrency-safe registration flow.
 *
 * Everything happens inside ONE database transaction on ONE connection:
 *
 *   1. SELECT ... FOR UPDATE locks the event row. Any other concurrent
 *      registration attempt for this SAME event now blocks at this exact
 *      line until this transaction commits or rolls back — there is no
 *      window where two requests can both read "1 seat left" and both
 *      proceed to insert. This single lock is what makes every rule below
 *      race-free, without needing a lock per rule.
 *   2. Business rules are checked in order (event exists, is published,
 *      deadline hasn't passed, employee isn't already registered,
 *      capacity isn't full).
 *   3. The first free seat is computed from the CURRENT set of active
 *      seats (read inside the same locked transaction, so it reflects
 *      reality even under heavy concurrent load).
 *   4. The registration is inserted. The partial unique indexes on the
 *      table (see the migration) are a second, independent guarantee: even
 *      if this application-level logic ever had a bug, the database
 *      itself would still refuse a duplicate seat or duplicate active
 *      registration.
 *   5. COMMIT releases the lock, letting the next queued request for this
 *      event proceed.
 */
const registerForEvent = async (eventId, userId) => {
  return registrationModel.withTransaction(async (client) => {
    const event = await registrationModel.lockEventForUpdate(client, eventId);

    if (!event) {
      throw new ApiError(404, 'Event not found');
    }

    if (event.status !== 'PUBLISHED') {
      throw new ApiError(409, 'This event is not currently open for registration');
    }

    if (new Date(event.registration_deadline) < new Date()) {
      throw new ApiError(409, 'The registration deadline for this event has passed');
    }

    const existingActive = await registrationModel.findActiveRegistrationForUser(
      client,
      eventId,
      userId
    );
    if (existingActive) {
      throw new ApiError(409, 'You are already registered for this event');
    }

    const activeCount = await registrationModel.countActiveRegistrations(client, eventId);
    if (activeCount >= event.capacity) {
      throw new ApiError(409, 'This event is full — no seats remaining');
    }

    const takenSeats = await registrationModel.getActiveSeatLabels(client, eventId);
    const seatLabel = findFirstAvailableSeat(event.capacity, takenSeats);

    // Defensive check only — activeCount < capacity was just verified
    // above inside the same lock, so this should be unreachable in
    // practice. Guards against ever inserting a null seat label.
    if (!seatLabel) {
      throw new ApiError(409, 'This event is full — no seats remaining');
    }

    const qrToken = generateQrToken();

    const registration = await registrationModel.insertRegistration(client, {
      eventId,
      userId,
      seatLabel,
      qrToken,
    });

    return toPublicRegistration({
      ...registration,
      event_title: event.title,
      event_venue: event.venue,
      event_date: event.event_date,
      event_start_time: event.start_time,
      event_end_time: event.end_time,
      event_status: event.status,
    });
  });
};

/**
 * The core concurrency-safe check-in flow — same pattern as
 * `registerForEvent`: everything happens inside ONE transaction, holding
 * a row lock for its entire duration.
 *
 *   1. `SELECT ... FOR UPDATE OF r` locks the registration row identified
 *      by its QR token. A second simultaneous scan of the SAME token
 *      blocks here until this transaction commits or rolls back, then
 *      re-reads the (by then updated) status — so two scans can never
 *      both see REGISTERED and both succeed.
 *   2. Status and event-state rules are checked while still holding the
 *      lock.
 *   3. The atomic conditional UPDATE (`WHERE status = 'REGISTERED'`) is a
 *      second, independent guarantee on top of the lock.
 *
 * SECURITY NOTE: this function receives a bare `token` string and must
 * NEVER include it in any thrown error's message — errors here are
 * generic ("Registration not found", "Already checked in", etc.) so that
 * even if an error is logged, the token itself never ends up in a log
 * line. The token is also never included in the success response — only
 * the resulting registration/event/employee summary is returned.
 */
const checkInByToken = async (token) => {
  return registrationModel.withTransaction(async (client) => {
    const registration = await registrationModel.lockByQrTokenForUpdate(client, token);

    if (!registration) {
      throw new ApiError(404, 'Registration not found');
    }

    if (registration.status === 'CANCELLED') {
      throw new ApiError(409, 'This registration has been cancelled');
    }

    if (registration.status === 'CHECKED_IN') {
      throw new ApiError(409, 'This registration has already been checked in');
    }

    if (registration.status === 'COMPLETED') {
      throw new ApiError(409, 'This registration is already marked as completed');
    }

    if (registration.status !== 'REGISTERED') {
      // Unreachable given the enum only has 4 values, all handled above —
      // defensive fallback in case the status set is ever extended.
      throw new ApiError(409, `Cannot check in a registration with status ${registration.status}`);
    }

    // Event-state rule: only an actively PUBLISHED event accepts
    // check-ins. A draft was never open to the public; a cancelled or
    // completed event shouldn't be accepting new attendance records.
    if (registration.event_status !== 'PUBLISHED') {
      throw new ApiError(
        409,
        `Cannot check in — this event is ${registration.event_status.toLowerCase()}, not published`
      );
    }

    const updated = await registrationModel.markCheckedIn(client, registration.id);

    if (!updated) {
      // Extremely unlikely given the lock + checks above, but if the
      // conditional UPDATE affected zero rows, don't report success.
      throw new ApiError(409, 'This registration is no longer eligible for check-in');
    }

    const full = await registrationModel.findFullByIdWithClient(client, registration.id);

    return {
      id: full.id,
      status: full.status,
      seatLabel: full.seat_label,
      checkedInAt: full.checked_in_at,
      employeeName: full.employee_name,
      event: {
        id: full.event_id,
        title: full.event_title,
        venue: full.event_venue,
      },
    };
  });
};

const getMyRegistrationForEvent = async (eventId, userId) => {
  const registration = await registrationModel.findActiveByEventAndUser(eventId, userId);
  if (!registration) {
    throw new ApiError(404, 'You do not have an active registration for this event');
  }
  return toPublicRegistration(registration);
};

const listMyRegistrations = async (userId, filters) => {
  const { registrations, pagination } = await registrationModel.listForUser(userId, filters);
  return { registrations: registrations.map(toPublicRegistration), pagination };
};

/**
 * Cancellation is intentionally NOT wrapped in the same event-row lock as
 * registration. Each cancellation only ever touches its OWN registration
 * row (by primary key) and only ever FREES a seat rather than contending
 * for one, so there's no race to protect against here — the atomic
 * conditional UPDATE in the model (`status = 'REGISTERED'` in the WHERE
 * clause) is sufficient on its own.
 */
const cancelRegistration = async (registrationId, requestingUser) => {
  const registration = await registrationModel.findById(registrationId);

  if (!registration) {
    throw new ApiError(404, 'Registration not found');
  }

  if (registration.user_id !== requestingUser.id) {
    // Same 404-vs-403 reasoning as elsewhere: an employee should not be
    // able to tell "doesn't exist" apart from "exists but isn't yours"
    // for another employee's private registration data. 403 is used here
    // (rather than 404) because the id itself came from the URL the
    // employee constructed, and revealing "this id belongs to someone,
    // just not you" doesn't leak anything sensitive the way event drafts
    // would.
    throw new ApiError(403, 'You can only cancel your own registration');
  }

  if (registration.status !== 'REGISTERED') {
    throw new ApiError(
      409,
      `Cannot cancel a registration that is already ${registration.status.toLowerCase()}`
    );
  }

  const cancelled = await registrationModel.cancelIfRegistered(registrationId);

  if (!cancelled) {
    // Someone else changed its status between our check above and now
    // (e.g. got checked in a split second earlier) — re-fetch for an
    // accurate error message rather than assuming.
    const current = await registrationModel.findById(registrationId);
    throw new ApiError(
      409,
      `Cannot cancel a registration that is already ${current.status.toLowerCase()}`
    );
  }

  return toPublicRegistration({ ...registration, ...cancelled });
};

/**
 * Retrieves the QR code image for a registration.
 *
 * Ownership is enforced purely from `requestingUser` — the value the
 * `authenticate` middleware derived from the verified JWT — never from
 * anything the client could supply in the URL or body. The registration
 * `id` in the URL only tells us WHICH record to look up; it is never
 * trusted to tell us WHO is allowed to see it.
 *
 * A cancelled registration is refused (409) rather than silently handed
 * back a QR: encoding is deterministic, so the image would still decode
 * to a token that exists in the database, and Phase 6's scanner will
 * separately re-check status at scan time regardless — but there is no
 * reason to ever hand out what looks like a valid, presentable ticket for
 * something the employee already cancelled.
 */
const getRegistrationQr = async (registrationId, requestingUser) => {
  const registration = await registrationModel.findById(registrationId);

  if (!registration) {
    throw new ApiError(404, 'Registration not found');
  }

  if (registration.user_id !== requestingUser.id) {
    throw new ApiError(403, 'You can only view your own registration QR code');
  }

  if (registration.status === 'CANCELLED') {
    throw new ApiError(409, 'This registration has been cancelled and no longer has an active QR code');
  }

  const dataUrl = await generateQrDataUrl(registration.qr_token);

  // Deliberately does NOT return the raw token in the JSON response — the
  // frontend only ever needs the rendered image (dataUrl) to display or
  // download. The token still lives inside the QR image itself (that's
  // the whole point), and still lives in the database exactly as before;
  // this only removes an unnecessary plaintext echo of a bearer-style
  // credential from an API response that doesn't need it.
  return {
    registrationId: registration.id,
    dataUrl,
  };
};

module.exports = {
  registerForEvent,
  getMyRegistrationForEvent,
  listMyRegistrations,
  cancelRegistration,
  getRegistrationQr,
  checkInByToken,
};
