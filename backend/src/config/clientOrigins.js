/**
 * CLIENT_URL may hold one origin or a comma-separated list
 * (e.g. "https://app.onrender.com,https://events.example.com") so a custom
 * domain can be added without dropping the onrender.com URL.
 *
 * - getAllowedOrigins(): every listed origin — used for CORS.
 * - getPrimaryClientUrl(): the FIRST listed origin — used to build links
 *   that end up in emails/PDFs/QR codes (certificate verification URLs),
 *   where exactly one canonical URL is needed.
 *
 * Trailing slashes are stripped: a browser's Origin header never has one,
 * so "https://x.onrender.com/" would otherwise never match.
 */

const DEFAULT_CLIENT_URL = 'http://localhost:5173';

const getAllowedOrigins = () => {
  const origins = (process.env.CLIENT_URL || DEFAULT_CLIENT_URL)
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return origins.length > 0 ? origins : [DEFAULT_CLIENT_URL];
};

const getPrimaryClientUrl = () => getAllowedOrigins()[0];

module.exports = { getAllowedOrigins, getPrimaryClientUrl };
