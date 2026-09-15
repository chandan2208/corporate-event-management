/**
 * Service layer: contains the actual logic for the health check.
 * Controllers stay "thin" (just handle req/res) and delegate real work here.
 * This separation matters once features grow — business logic stays
 * reusable and testable independent of Express.
 */

const { checkConnection } = require('../config/db');

const getHealthStatus = async () => {
  const dbConnected = await checkConnection();

  return {
    server: 'ok',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  };
};

module.exports = { getHealthStatus };
