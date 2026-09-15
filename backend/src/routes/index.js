const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const eventRoutes = require('./event.routes');
const registrationRoutes = require('./registration.routes');
const speakerRoutes = require('./speaker.routes');
const scheduleRoutes = require('./schedule.routes');
const feedbackRoutes = require('./feedback.routes');
const certificateRoutes = require('./certificate.routes');
const dashboardRoutes = require('./dashboard.routes');
const adminDashboardRoutes = require('./adminDashboard.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/events', eventRoutes);

// certificateRoutes is mounted here, BEFORE registrationRoutes/speakerRoutes/
// scheduleRoutes/feedbackRoutes, for a subtle but important reason: those
// four routers are each mounted at '/' (no prefix) and each has a blanket
// `router.use(authenticate)` at the top of their own file. Express runs
// that blanket middleware for EVERY request that reaches them, regardless
// of whether any of that router's own routes actually match the path —
// and since `authenticate` calls next(err) on failure, an unauthenticated
// request gets bounced straight to the error handler before ever reaching
// a LATER-mounted router. certificateRoutes has one genuinely PUBLIC route
// (GET /certificates/verify/:token, used by anyone scanning a certificate's
// QR code with no login) — it must be tried before any of those blanket-
// authenticate routers get a chance to intercept it. Mounting order is the
// fix; none of those four routers' own files needed to change.
router.use('/', certificateRoutes);

// dashboardRoutes applies `authenticate` per-route (not as a blanket
// router.use), so — unlike registrationRoutes/speakerRoutes/scheduleRoutes/
// feedbackRoutes below — its mount position doesn't risk intercepting any
// public route from another router.
router.use('/', dashboardRoutes);
router.use('/', adminDashboardRoutes);

// Mounted at root, not under a prefix, because its own paths already
// include the full segments they need (/events/:eventId/register,
// /my-registrations, /registrations/:id) — these don't collide with
// eventRoutes above since none of eventRoutes' own patterns match a
// trailing "/register" or "/registration" segment, so unmatched requests
// correctly fall through to this router next.
router.use('/', registrationRoutes);

// Same reasoning: /events/:eventId/speakers and /events/:eventId/schedule
// don't match eventRoutes' own single-segment patterns, so they fall
// through correctly to these routers.
router.use('/', speakerRoutes);
router.use('/', scheduleRoutes);
router.use('/', feedbackRoutes);

module.exports = router;
