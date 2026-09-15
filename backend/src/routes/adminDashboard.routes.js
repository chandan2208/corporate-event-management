const express = require('express');
const adminDashboardController = require('../controllers/adminDashboard.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validateQuery = require('../middleware/validateQuery');
const { dashboardQuerySchema } = require('../validators/adminDashboard.validator');

const router = express.Router();

// Admin-only, same convention as every other admin-facing endpoint in the
// app — an employee hitting this gets 403, not a restricted employee view.
router.get(
  '/admin/dashboard',
  authenticate,
  authorize('admin'),
  validateQuery(dashboardQuerySchema),
  adminDashboardController.getAdminDashboard
);

module.exports = router;
