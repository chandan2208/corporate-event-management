const registrationModel = require('../models/registration.model');
const certificateService = require('./certificate.service');
const dashboardModel = require('../models/dashboard.model');

const ELIGIBLE_FOR_CERT_AND_FEEDBACK = ['CHECKED_IN', 'COMPLETED'];

const toDashboardRegistration = (row, feedbackEventIds) => ({
  registrationId: row.id,
  status: row.status,
  seatLabel: row.seat_label,
  registeredAt: row.registered_at,
  checkedInAt: row.checked_in_at,
  cancelledAt: row.cancelled_at,
  qrAvailable: row.status !== 'CANCELLED',
  certificateEligible: ELIGIBLE_FOR_CERT_AND_FEEDBACK.includes(row.status),
  feedbackEligible: ELIGIBLE_FOR_CERT_AND_FEEDBACK.includes(row.status),
  feedbackSubmitted: feedbackEventIds.has(row.event_id),
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
 * This service is deliberately thin on NEW business logic — it reuses
 * registrationModel.listForUser (Phase 4/6, unmodified) and
 * certificateService.listMyCertificates (Phase 9, unmodified), plus two
 * new, additive, BATCHED queries (dashboard.model.js) for feedback status
 * and schedule/speaker info across all relevant events at once — no
 * per-registration loop, no N+1.
 *
 * No certificate eligibility/generation logic, no feedback eligibility
 * logic, and no QR logic are reimplemented here — the dashboard only
 * reports status; the actual actions (download certificate, view QR,
 * submit feedback) are performed by the frontend re-using the existing,
 * already-tested Phase 5/8/9 components/endpoints.
 *
 * Employee identity (`userId`) is always the id the controller derived
 * from the verified JWT (req.user.id) — this function never accepts or
 * looks at any client-supplied identifier.
 */
const getEmployeeDashboard = async (userId) => {
  const { registrations: rawRegistrations } = await registrationModel.listForUser(userId, {
    limit: 100,
  });

  const feedbackRows = await dashboardModel.getFeedbackForUser(userId);
  const feedbackEventIds = new Set(feedbackRows.map((r) => r.event_id));
  const feedbackTimestampByEvent = new Map(feedbackRows.map((r) => [r.event_id, r.created_at]));

  const certificates = await certificateService.listMyCertificates(userId);

  const registrations = rawRegistrations.map((row) => toDashboardRegistration(row, feedbackEventIds));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingAll = registrations.filter(
    (r) => r.status !== 'CANCELLED' && r.event.status !== 'CANCELLED' && new Date(r.event.eventDate) >= today
  );
  upcomingAll.sort((a, b) => new Date(a.event.eventDate) - new Date(b.event.eventDate));

  const upcomingEventIds = [...new Set(upcomingAll.slice(0, 5).map((r) => r.event.id))];
  const scheduleRows = await dashboardModel.getScheduleForEvents(upcomingEventIds);
  const scheduleByEvent = new Map();
  scheduleRows.forEach((row) => {
    const list = scheduleByEvent.get(row.event_id) || [];
    list.push({
      title: row.title,
      startTime: row.start_time,
      endTime: row.end_time,
      location: row.location,
      speakerName: row.speaker_name,
      speakerDesignation: row.speaker_designation,
      speakerCompany: row.speaker_company,
    });
    scheduleByEvent.set(row.event_id, list);
  });

  const upcomingEvents = upcomingAll.slice(0, 5).map((r) => ({
    ...r,
    schedule: scheduleByEvent.get(r.event.id) || [],
  }));

  const summary = {
    upcomingEvents: upcomingAll.length,
    registeredEvents: registrations.filter((r) => r.status !== 'CANCELLED').length,
    attendedEvents: registrations.filter((r) => ['CHECKED_IN', 'COMPLETED'].includes(r.status)).length,
    certificatesAvailable: registrations.filter((r) => r.certificateEligible).length,
    feedbackPending: registrations.filter((r) => r.feedbackEligible && !r.feedbackSubmitted).length,
  };

  const activity = [];
  registrations.forEach((r) => {
    activity.push({ type: 'REGISTERED', message: `Registered for ${r.event.title}`, timestamp: r.registeredAt });
    if (r.checkedInAt) {
      activity.push({ type: 'CHECKED_IN', message: `Checked in to ${r.event.title}`, timestamp: r.checkedInAt });
    }
    if (r.cancelledAt) {
      activity.push({
        type: 'CANCELLED',
        message: `Cancelled registration for ${r.event.title}`,
        timestamp: r.cancelledAt,
      });
    }
    const feedbackAt = feedbackTimestampByEvent.get(r.event.id);
    if (feedbackAt) {
      activity.push({
        type: 'FEEDBACK_SUBMITTED',
        message: `Submitted feedback for ${r.event.title}`,
        timestamp: feedbackAt,
      });
    }
  });
  certificates.forEach((c) => {
    activity.push({
      type: 'CERTIFICATE_ISSUED',
      message: `Certificate issued for ${c.event?.title || 'an event'}`,
      timestamp: c.issuedAt,
    });
  });
  activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return {
    summary,
    upcomingEvents,
    registrations,
    certificates,
    recentActivity: activity.slice(0, 10),
  };
};

module.exports = { getEmployeeDashboard };
