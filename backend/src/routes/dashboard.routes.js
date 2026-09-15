const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

// Employee-only, same convention as every other employee-facing endpoint
// in the app (registrations, certificates, feedback) — admins get a 403
// here rather than an unrestricted view of an arbitrary employee's data.
router.get('/employee/dashboard', authenticate, authorize('employee'), dashboardController.getEmployeeDashboard);

module.exports = router;
