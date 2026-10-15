const { getHealthStatus } = require('../services/health.service');

/**
 * GET /api/health
 * Returns whether the server is up and whether it can reach PostgreSQL.
 * Wrapped in try/catch and forwards any failure to next(err), so the
 * centralized errorHandler middleware formats the response consistently.
 *
 * Responds 503 (same body shape) when the database is unreachable: every
 * real feature needs the database, so "process up, DB down" is an outage,
 * and Render's health check (and any uptime monitor) only sees the status
 * code. Previously this returned 200 regardless, which hid a suspended
 * database behind a "healthy" service.
 */
const checkHealth = async (req, res, next) => {
  try {
    const status = await getHealthStatus();
    const healthy = status.database === 'connected';

    return res.status(healthy ? 200 : 503).json({
      success: healthy,
      data: status,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { checkHealth };
