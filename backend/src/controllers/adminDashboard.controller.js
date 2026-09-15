const adminDashboardService = require('../services/adminDashboard.service');

const getAdminDashboard = async (req, res, next) => {
  try {
    // Read from req.validatedQuery (set by the validateQuery middleware),
    // NOT req.query directly — see validateQuery.js for why: Express 5's
    // req.query is a read-only getter that can't hold the
    // validated/defaulted values, so they're attached to a separate
    // property instead. `days` is guaranteed to be a safe integer 1-365,
    // `status` (if present) is guaranteed to be one of the real
    // event_status enum values.
    const dashboard = await adminDashboardService.getAdminDashboard(req.validatedQuery);
    res.status(200).json({ success: true, data: dashboard });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAdminDashboard };
