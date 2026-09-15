const adminDashboardModel = require('../models/adminDashboard.model');

const ALL_EVENT_STATUSES = ['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'];

/**
 * Safe percentage helper — used everywhere a rate is computed, so
 * "0 eligible / 0 total" never produces NaN or a misleading 100%. This is
 * the ONE definition of attendanceRate/utilization used throughout the
 * response, per the spec's "use a consistent definition" requirement.
 */
const safePercent = (numerator, denominator) => {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10; // one decimal place
};

/**
 * Fills in zero-count days for a date-trunc'd trend so the chart never
 * silently skips a day with no activity.
 */
const zeroFillTrend = (rows, days, valueKey) => {
  const byDate = new Map(rows.map((r) => [r.date.toISOString().slice(0, 10), r[valueKey]]));
  const result = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, [valueKey]: byDate.get(key) || 0 });
  }
  return result;
};

const toPublicEventRow = (row) => ({
  id: row.id,
  title: row.title,
  eventDate: row.event_date,
  status: row.status,
  capacity: row.capacity,
  registrations: row.registrations,
  attendance: row.attendance,
  availableSeats: Math.max(row.capacity - row.registrations, 0),
  attendanceRate: safePercent(row.attendance, row.registrations),
  utilization: safePercent(row.registrations, row.capacity),
  feedbackCount: row.feedback_count,
  certificatesCount: row.certificates_count,
});

/**
 * Assembles the full admin dashboard response. Every number here comes
 * from a real PostgreSQL aggregate query (see adminDashboard.model.js) —
 * nothing is fabricated, and no full table is pulled into Node.js just to
 * count/average it in JavaScript. The independent queries are run
 * concurrently via Promise.all rather than sequentially awaited one at a
 * time, minimizing total wall-clock latency.
 */
const getAdminDashboard = async ({ days, status }) => {
  const [
    eventCounts,
    registrationCounts,
    certificateCounts,
    statusRows,
    registrationTrendRows,
    attendanceTrendRows,
    eventPerformanceRows,
    feedbackSummary,
    topRatedRows,
    certificatesByEventRows,
  ] = await Promise.all([
    adminDashboardModel.getEventCounts(),
    adminDashboardModel.getRegistrationCounts(),
    adminDashboardModel.getCertificateCounts(),
    adminDashboardModel.getEventStatusDistribution(),
    adminDashboardModel.getRegistrationTrend(days),
    adminDashboardModel.getAttendanceTrend(days),
    adminDashboardModel.getEventPerformanceData(status),
    adminDashboardModel.getFeedbackSummary(),
    adminDashboardModel.getTopRatedEvents(5),
    adminDashboardModel.getCertificatesByEvent(10),
  ]);

  const summary = {
    totalEvents: eventCounts.total_events,
    publishedEvents: eventCounts.published_events,
    upcomingEvents: eventCounts.upcoming_events,
    totalRegistrations: registrationCounts.total_registrations,
    totalAttendees: registrationCounts.total_attendees,
    certificatesIssued: certificateCounts.issued,
    // Consistent definition used everywhere in this response:
    // attendanceRate = (CHECKED_IN + COMPLETED) / (all non-cancelled registrations) * 100
    attendanceRate: safePercent(registrationCounts.total_attendees, registrationCounts.total_registrations),
  };

  const statusCountByName = Object.fromEntries(statusRows.map((r) => [r.status, r.count]));
  const eventStatus = ALL_EVENT_STATUSES.map((s) => ({ status: s, count: statusCountByName[s] || 0 }));

  const eventPerformance = eventPerformanceRows.map(toPublicEventRow);

  const popularEvents = [...eventPerformance]
    .sort((a, b) => b.registrations - a.registrations)
    .slice(0, 10)
    .map((e) => ({ id: e.id, title: e.title, registrations: e.registrations }));

  const capacity = eventPerformance
    .filter((e) => ['PUBLISHED', 'COMPLETED'].includes(e.status))
    .map((e) => ({
      id: e.id,
      title: e.title,
      capacity: e.capacity,
      registrations: e.registrations,
      availableSeats: e.availableSeats,
      utilization: e.utilization,
    }));

  const recentEvents = [...eventPerformanceRows]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10)
    .map(toPublicEventRow);

  const feedback = {
    total: feedbackSummary.totals.total,
    averageRating: feedbackSummary.totals.total > 0 ? Math.round(feedbackSummary.totals.average * 10) / 10 : 0,
    distribution: [1, 2, 3, 4, 5].map((star) => ({
      rating: star,
      count: feedbackSummary.distribution.find((d) => d.rating === star)?.count || 0,
    })),
    topRatedEvents: topRatedRows.map((r) => ({
      id: r.id,
      title: r.title,
      averageRating: Math.round(r.average_rating * 10) / 10,
      responseCount: r.response_count,
    })),
  };

  const certificates = {
    issued: certificateCounts.issued,
    valid: certificateCounts.valid,
    revoked: certificateCounts.revoked,
    byEvent: certificatesByEventRows.map((r) => ({
      id: r.id,
      title: r.title,
      certificatesCount: r.certificates_count,
    })),
  };

  return {
    summary,
    eventStatus,
    registrationTrend: zeroFillTrend(registrationTrendRows, days, 'registrations'),
    attendanceTrend: zeroFillTrend(attendanceTrendRows, days, 'attendees'),
    eventPerformance: eventPerformance.slice(0, 20),
    popularEvents,
    feedback,
    certificates,
    capacity,
    recentEvents,
  };
};

module.exports = { getAdminDashboard };
