const dashboardService = require('../services/dashboard.service');

const getEmployeeDashboard = async (req, res, next) => {
  try {
    // req.user.id comes from the verified JWT (authenticate middleware) —
    // this is the ONLY source of identity for whose dashboard is
    // returned. There is no userId query param or body field accepted
    // anywhere in this route; a request like
    // /api/employee/dashboard?userId=someone-else is simply ignored.
    const dashboard = await dashboardService.getEmployeeDashboard(req.user.id);
    res.status(200).json({ success: true, data: dashboard });
  } catch (err) {
    next(err);
  }
};

module.exports = { getEmployeeDashboard };
