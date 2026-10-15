/**
 * This file builds and configures the Express "app" object:
 * middleware, routes, and error handlers.
 *
 * It deliberately does NOT call app.listen() — that lives in server.js —
 * so that this file can also be imported directly by automated tests later
 * without starting a real network server.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const apiRoutes = require('./routes');
const { getAllowedOrigins } = require('./config/clientOrigins');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// Render (and most PaaS hosts) put the app behind a reverse proxy, which
// sets X-Forwarded-For/X-Forwarded-Proto on every request. Without this,
// Express doesn't know to trust that header, and express-rate-limit
// (which uses the client IP to key its counters) throws
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR rather than silently trusting a
// header that could otherwise be spoofed by a direct client.
//
// `1` means "trust exactly one hop" (the single Render proxy in front of
// this single backend instance) — req.ip becomes the real client IP from
// the first X-Forwarded-For entry, not the proxy's own address, without
// blindly trusting an arbitrary chain of forwarded-for values a client
// could otherwise fake. This must be set before any middleware
// (including rate limiting) runs, so it's the very first line here.
app.set('trust proxy', 1);

// --- Global middleware ---

// Sets a range of security-related HTTP headers (X-Content-Type-Options,
// X-Frame-Options, etc.) with sane defaults for an API server.
app.use(helmet());

// Allow the frontend (running on a different port/origin) to call this API.
// `credentials: true` is required so the browser will send/receive the
// httpOnly refresh-token cookie across origins. CLIENT_URL may list several
// comma-separated origins (see config/clientOrigins.js); only an exact
// match is reflected back, any other origin gets no CORS headers at all.
app.use(
  cors({
    origin: getAllowedOrigins(),
    credentials: true,
  })
);

// Parse incoming JSON request bodies into req.body. An explicit size
// limit (rather than relying on the framework default) bounds how much
// work a single request can force the server to do parsing — nothing in
// this API legitimately needs a body anywhere close to this size (the
// largest real payloads are a feedback comment capped at 2000 chars and
// an event description capped at 5000 chars).
app.use(express.json({ limit: '200kb' }));

// Parse incoming URL-encoded bodies (simple HTML forms), just in case —
// same reasoning on the explicit limit.
app.use(express.urlencoded({ extended: true, limit: '200kb' }));

// Parse cookies (needed to read the httpOnly refresh-token cookie).
app.use(cookieParser());

// --- Routes ---
app.use('/api', apiRoutes);

// --- 404 + error handling (must be registered LAST) ---
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
