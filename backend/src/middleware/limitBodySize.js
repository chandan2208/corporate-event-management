const ApiError = require('../utils/ApiError');

/**
 * Phase 15: a much tighter per-route body cap than the global 200kb JSON
 * limit, for small public endpoints (verify-email / resend-verification)
 * whose legitimate payload is a few dozen bytes. Rejects with 413 before
 * validation or any database work happens.
 *
 * Checks the declared Content-Length first; for chunked requests without
 * one, measures the already-parsed body.
 */
const limitBodySize = (maxBytes) => (req, res, next) => {
  const declared = parseInt(req.headers['content-length'], 10);
  let size = Number.isFinite(declared) ? declared : 0;

  if (!Number.isFinite(declared) && req.body !== undefined) {
    try {
      size = Buffer.byteLength(JSON.stringify(req.body) || '');
    } catch {
      size = Infinity;
    }
  }

  if (size > maxBytes) {
    return next(new ApiError(413, 'Request payload too large', null, 'PAYLOAD_TOO_LARGE'));
  }
  next();
};

module.exports = limitBodySize;
