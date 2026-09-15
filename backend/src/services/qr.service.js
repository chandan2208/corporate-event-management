const QRCode = require('qrcode');

/**
 * QR generation lives here, isolated from routes/controllers, so:
 *   - the encoding format is defined in exactly one place
 *   - it's trivially testable in isolation (see the test script)
 *   - swapping the underlying library later only touches this file
 *
 * We use the `qrcode` npm package (https://www.npmjs.com/package/qrcode) —
 * actively maintained, ~40M weekly downloads, zero runtime dependencies,
 * supports PNG/SVG/data-URL output. It's the de-facto standard choice for
 * server-side QR generation in Node.
 *
 * FIXED OPTIONS ARE INTENTIONAL: error correction level, margin, and width
 * are hardcoded constants (not derived from anything request-specific), so
 * that encoding the SAME token always produces the SAME image bytes —
 * this is what "deterministic" means here, and it's what lets Phase 6's
 * scanner (or a decode-verification test, see the test script) always
 * find the exact original token again.
 */
const QR_OPTIONS = {
  errorCorrectionLevel: 'M', // matches decode reliability, has to be resilient
  margin: 2,
  width: 320,
  type: 'image/png',
};

/**
 * Encodes ONLY the raw registration token — nothing else. No employee
 * name, email, phone number, or any other personal data ever goes into
 * the QR payload. This is deliberate: the token is a random, unguessable,
 * non-identifying string on its own (see utils/qrToken.js), so even if
 * someone photographs or intercepts the QR image, it reveals nothing
 * about who the registration belongs to — only the backend, which
 * enforces ownership on every lookup, can resolve it back to a person.
 *
 * Returns a base64 data URL (e.g. "data:image/png;base64,...") that a
 * frontend can drop straight into an <img src> or offer as a download,
 * with no separate file storage needed.
 */
const generateQrDataUrl = async (token) => {
  return QRCode.toDataURL(token, QR_OPTIONS);
};

module.exports = { generateQrDataUrl, QR_OPTIONS };
