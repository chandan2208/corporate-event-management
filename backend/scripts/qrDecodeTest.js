/**
 * Permanent regression test for QR code generation (Phase 5).
 *
 * Generates a QR code from a KNOWN, fixed test token, decodes the
 * resulting PNG image back to text, and asserts the decoded value exactly
 * matches the original token. This is what actually proves the QR
 * encodes the right thing — not just that image generation didn't throw.
 *
 * Does NOT touch the database or require the server to be running; it
 * exercises qr.service.js directly, so it's fast and fully deterministic.
 *
 * Run with: npm run test:qr
 */

const assert = require('assert');
const { PNG } = require('pngjs');
const jsQR = require('jsqr');
const { generateQrDataUrl } = require('../src/services/qr.service');

// A fixed, known-format token (64 hex chars, matching utils/qrToken.js's
// output shape) — NOT a real registration token from any real account.
const KNOWN_TEST_TOKEN =
  'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9';

const decodeDataUrlToText = (dataUrl) => {
  const base64 = dataUrl.split(',')[1];
  const pngBuffer = Buffer.from(base64, 'base64');
  const png = PNG.sync.read(pngBuffer);
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return decoded ? decoded.data : null;
};

const run = async () => {
  console.log('--- QR decode regression test ---');

  // 1. Generate a QR for the known token.
  const dataUrl = await generateQrDataUrl(KNOWN_TEST_TOKEN);
  assert.ok(dataUrl.startsWith('data:image/png;base64,'), 'Output should be a PNG data URL');
  console.log('✓ Generated a PNG data URL');

  // 2. Decode it back and assert an EXACT match against the original token.
  const decoded = decodeDataUrlToText(dataUrl);
  assert.strictEqual(
    decoded,
    KNOWN_TEST_TOKEN,
    `Decoded value "${decoded}" did not exactly match the original token`
  );
  console.log('✓ Decoded value exactly matches the original token');

  // 3. Determinism: generating the same token twice must produce
  //    byte-identical output (same options, no randomness).
  const dataUrlAgain = await generateQrDataUrl(KNOWN_TEST_TOKEN);
  assert.strictEqual(dataUrl, dataUrlAgain, 'Same token must always produce the same QR image');
  console.log('✓ Generation is deterministic (identical output on repeat calls)');

  // 4. Sanity check the negative case: a different token must decode to
  //    a different value (i.e. this isn't a test that would pass no
  //    matter what).
  const otherToken = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  const otherDataUrl = await generateQrDataUrl(otherToken);
  const otherDecoded = decodeDataUrlToText(otherDataUrl);
  assert.strictEqual(otherDecoded, otherToken);
  assert.notStrictEqual(otherDecoded, KNOWN_TEST_TOKEN);
  console.log('✓ Different tokens produce different, correctly-decodable QR codes');

  console.log('\nPASS: all QR decode regression checks passed.');
};

run().catch((err) => {
  console.error('\nFAIL:', err.message);
  process.exit(1);
});
