const ApiError = require('../utils/ApiError');
const { query } = require('../config/db');
const feedbackModel = require('../models/feedback.model');
const eventModel = require('../models/event.model');

const EVENT_STATES_BLOCKING_FEEDBACK = ['DRAFT', 'CANCELLED'];
const ELIGIBLE_REGISTRATION_STATUSES = ['CHECKED_IN', 'COMPLETED'];

const toPublicFeedback = (row) => ({
  id: row.id,
  eventId: row.event_id,
  registrationId: row.registration_id,
  rating: row.rating,
  comment: row.comment,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toAdminPublicFeedback = (row) => ({
  ...toPublicFeedback(row),
  employeeName: row.employee_name,
});

/**
 * Finds the employee's registration for this event REGARDLESS of status
 * (unlike registration.service.js's own lookups, which only ever surface
 * ACTIVE — non-cancelled — registrations). Feedback eligibility needs to
 * distinguish "no registration at all" from "registration exists but is
 * CANCELLED" from "registration exists and is REGISTERED but not yet
 * checked in" — three different situations. Read-only, feedback-specific
 * query; Phase 4's registration model/service files are not modified.
 */
const findAnyRegistrationForEventAndUser = async (eventId, userId) => {
  const result = await query(
    `SELECT id, status FROM registrations WHERE event_id = $1 AND user_id = $2
     ORDER BY registered_at DESC LIMIT 1`,
    [eventId, userId]
  );
  return result.rows[0] || null;
};

/**
 * Submits feedback on behalf of `userId` — always derived from the
 * verified JWT (req.user.id in the controller), never from anything in
 * the request body. There is no client-suppliable field that could make
 * this act on a different registration; the only registration ever
 * considered is the one this exact lookup finds for THIS user and THIS
 * event.
 */
const submitFeedback = async (eventId, userId, data) => {
  const event = await eventModel.findById(eventId);
  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  if (EVENT_STATES_BLOCKING_FEEDBACK.includes(event.status)) {
    throw new ApiError(
      409,
      `Feedback cannot be submitted for an event that is ${event.status.toLowerCase()}`
    );
  }

  const registration = await findAnyRegistrationForEventAndUser(eventId, userId);

  if (!registration) {
    throw new ApiError(409, 'You must be registered and checked in to this event to leave feedback');
  }

  if (!ELIGIBLE_REGISTRATION_STATUSES.includes(registration.status)) {
    throw new ApiError(
      409,
      registration.status === 'CANCELLED'
        ? 'Your registration for this event was cancelled — feedback is not available'
        : 'Feedback is available only after check-in'
    );
  }

  try {
    const feedback = await feedbackModel.insertFeedback({
      eventId,
      userId,
      registrationId: registration.id,
      rating: data.rating,
      comment: data.comment,
    });
    return toPublicFeedback(feedback);
  } catch (err) {
    // Postgres unique-violation code — the authoritative duplicate check.
    // Even if two requests both passed the eligibility checks above at
    // nearly the same instant, only one INSERT can succeed against the
    // UNIQUE(event_id, user_id) constraint; the other lands here.
    if (err.code === '23505') {
      throw new ApiError(409, 'You have already submitted feedback for this event');
    }
    throw err;
  }
};

const getMyFeedback = async (eventId, userId) => {
  const feedback = await feedbackModel.findByEventAndUser(eventId, userId);
  if (!feedback) {
    throw new ApiError(404, 'You have not submitted feedback for this event');
  }
  return toPublicFeedback(feedback);
};

const listFeedbackForEvent = async (eventId) => {
  const event = await eventModel.findById(eventId);
  if (!event) {
    throw new ApiError(404, 'Event not found');
  }
  const rows = await feedbackModel.listByEvent(eventId);
  return rows.map(toAdminPublicFeedback);
};

const getFeedbackSummary = async (eventId) => {
  const event = await eventModel.findById(eventId);
  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  const { total, average, distributionRows } = await feedbackModel.getSummaryByEvent(eventId);

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  distributionRows.forEach((row) => {
    distribution[row.rating] = row.count;
  });

  return {
    averageRating: total > 0 ? Math.round(average * 10) / 10 : 0,
    totalResponses: total,
    distribution,
  };
};

module.exports = { submitFeedback, getMyFeedback, listFeedbackForEvent, getFeedbackSummary };
