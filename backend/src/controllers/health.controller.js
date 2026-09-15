const { getHealthStatus } = require('../services/health.service');

/**
 * GET /api/health
 * Returns whether the server is up and whether it can reach PostgreSQL.
 * Wrapped in try/catch and forwards any failure to next(err), so the
 * centralized errorHandler middleware formats the response consistently.
 */
const checkHealth = async (req, res, next) => {
  try {
    const status = await getHealthStatus();

    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { checkHealth };
