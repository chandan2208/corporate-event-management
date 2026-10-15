const ApiError = require('../utils/ApiError');
const certificateModel = require('../models/certificate.model');
const { generateQrToken } = require('../utils/qrToken');
const { generateCertificateNumber } = require('../utils/certificateNumber');
const { generateQrDataUrl } = require('./qr.service');
const { generateCertificatePdfBuffer } = require('./certificatePdf');
const { getPrimaryClientUrl } = require('../config/clientOrigins');

const ELIGIBLE_STATUSES = ['CHECKED_IN', 'COMPLETED'];
const ORGANIZER_NAME = 'Corporate Event Management';

const toPublicCertificate = (row) => ({
  id: row.id,
  registrationId: row.registration_id,
  eventId: row.event_id,
  certificateNumber: row.certificate_number,
  issuedAt: row.issued_at,
  revokedAt: row.revoked_at,
  status: row.revoked_at ? 'REVOKED' : 'VALID',
  event: row.event_title
    ? { title: row.event_title, eventDate: row.event_date, venue: row.event_venue }
    : undefined,
  verificationUrl: `${getPrimaryClientUrl()}/verify/certificate/${row.verification_token}`,
});

const toAdminPublicCertificate = (row) => ({
  ...toPublicCertificate(row),
  employeeName: row.employee_name,
});

/**
 * Checks eligibility for a given registration row (as returned by
 * certificateModel.findRegistrationForCertificate) and throws a clear
 * error if not eligible. Shared by both the employee and admin
 * generation paths so the rule is defined in exactly one place.
 */
const assertEligible = (registration) => {
  if (!registration) {
    throw new ApiError(404, 'Registration not found');
  }
  if (registration.status === 'CANCELLED') {
    throw new ApiError(409, 'This registration was cancelled — no certificate is available');
  }
  if (!ELIGIBLE_STATUSES.includes(registration.status)) {
    throw new ApiError(409, 'A certificate is available only after check-in');
  }
};

/**
 * Idempotent get-or-create. This is the core of the idempotency
 * requirement: calling this repeatedly (sequentially or concurrently) for
 * the same registration always converges to returning the SAME single
 * certificate row.
 *
 *   1. If a certificate already exists for this registration, return it
 *      as-is (even if revoked — see the module-level docs on revocation
 *      behavior) rather than creating a second one.
 *   2. Otherwise attempt to INSERT a new certificate with a freshly
 *      generated number/token.
 *   3. If a concurrent request won the race and inserted first, our own
 *      INSERT fails with a unique-violation on registration_id — caught
 *      here, and we simply re-fetch and return the winner's row instead
 *      of erroring. Two callers racing to generate a certificate for the
 *      same registration both end up with a 200 and the same certificate
 *      — never a crash, never a duplicate.
 *   4. On the vanishingly unlikely chance of a certificate_number or
 *      verification_token collision with a DIFFERENT registration, retry
 *      with freshly generated values (bounded to a few attempts).
 */
const getOrCreateCertificateForRegistration = async (registrationId, requestingUser) => {
  const registration = await certificateModel.findRegistrationForCertificate(registrationId);
  assertEligible(registration);

  // Ownership check: an employee may only ever generate/fetch a
  // certificate for THEIR OWN registration. This is what closes the IDOR
  // hole — without it, an employee could pass any registration_id in the
  // URL and receive someone else's certificate. Admins bypass this check
  // (they're allowed to generate a certificate for any registration),
  // signaled by the caller passing `requestingUser: null` from the admin
  // route — see certificate.controller.js's adminGenerateCertificate.
  if (requestingUser && registration.user_id !== requestingUser.id) {
    throw new ApiError(403, 'You can only access your own certificate');
  }

  const existing = await certificateModel.findByRegistrationId(registrationId);
  if (existing) {
    return toPublicCertificate({ ...existing, event_title: registration.event_title, event_date: registration.event_date, event_venue: registration.event_venue });
  }

  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const certificateNumber = generateCertificateNumber();
    const verificationToken = generateQrToken();

    try {
      const created = await certificateModel.insertCertificate({
        registrationId,
        eventId: registration.event_id,
        userId: registration.user_id,
        certificateNumber,
        verificationToken,
      });
      return toPublicCertificate({
        ...created,
        event_title: registration.event_title,
        event_date: registration.event_date,
        event_venue: registration.event_venue,
      });
    } catch (err) {
      if (err.code === '23505') {
        // Which unique constraint fired matters: if it was
        // registration_id, someone else won the race for THIS
        // registration — the correct move is to return THEIR row, not
        // retry. If it was certificate_number/verification_token
        // colliding with an unrelated row, retry with fresh random
        // values instead.
        const raced = await certificateModel.findByRegistrationId(registrationId);
        if (raced) {
          return toPublicCertificate({
            ...raced,
            event_title: registration.event_title,
            event_date: registration.event_date,
            event_venue: registration.event_venue,
          });
        }
        if (attempt < MAX_ATTEMPTS) continue;
      }
      throw err;
    }
  }

  throw new ApiError(500, 'Could not generate a unique certificate after multiple attempts');
};

const getMyCertificate = async (certificateId, requestingUser) => {
  const certificate = await certificateModel.findById(certificateId);
  if (!certificate) {
    throw new ApiError(404, 'Certificate not found');
  }
  if (requestingUser.role !== 'admin' && certificate.user_id !== requestingUser.id) {
    throw new ApiError(403, 'You can only access your own certificate');
  }
  return certificate; // internal shape, caller decides public projection
};

const listMyCertificates = async (userId) => {
  const rows = await certificateModel.listForUser(userId);
  return rows.map(toPublicCertificate);
};

const listAllCertificates = async (filters) => {
  const { certificates, pagination } = await certificateModel.listAll(filters);
  return { certificates: certificates.map(toAdminPublicCertificate), pagination };
};

const getCertificateDetailForAdmin = async (certificateId) => {
  const certificate = await certificateModel.findById(certificateId);
  if (!certificate) {
    throw new ApiError(404, 'Certificate not found');
  }
  return toAdminPublicCertificate(certificate);
};

/**
 * Revocation is a one-way, idempotent-safe operation: revoking an
 * already-revoked certificate returns a clean 409 rather than silently
 * no-op'ing, so an admin gets clear feedback. The certificate row itself
 * is NEVER deleted — see the migration's docs.
 *
 * By design, once revoked, calling getOrCreateCertificateForRegistration
 * again for the same registration still returns this same (now revoked)
 * row — a fresh certificate is never silently issued to replace a
 * revoked one. If a new certificate is ever genuinely warranted, that
 * would need a deliberate, separate admin action (not implemented in
 * this phase, since the spec did not ask for a "re-issue" flow).
 */
const revokeCertificate = async (certificateId) => {
  const existing = await certificateModel.findById(certificateId);
  if (!existing) {
    throw new ApiError(404, 'Certificate not found');
  }
  if (existing.revoked_at) {
    throw new ApiError(409, 'This certificate is already revoked');
  }

  const revoked = await certificateModel.revokeIfActive(certificateId);
  if (!revoked) {
    throw new ApiError(409, 'This certificate is already revoked');
  }
  return toAdminPublicCertificate({ ...existing, ...revoked });
};

/**
 * Public verification — deliberately returns ONLY safe, non-sensitive
 * fields, and NEVER the raw verification_token itself (the caller already
 * has it, from the URL; echoing it back adds nothing and this keeps the
 * response shape consistent with "never expose the token" regardless of
 * where it's called from).
 */
const verifyByToken = async (token) => {
  const certificate = await certificateModel.findByVerificationToken(token);
  if (!certificate) {
    throw new ApiError(404, 'Certificate not found');
  }

  return {
    status: certificate.revoked_at ? 'REVOKED' : 'VALID',
    certificateNumber: certificate.certificate_number,
    employeeName: certificate.employee_name,
    eventTitle: certificate.event_title,
    eventDate: certificate.event_date,
    issuedAt: certificate.issued_at,
  };
};

/**
 * Generates the downloadable PDF for a certificate. Ownership/revocation
 * rules are enforced by the CALLER (feedback.controller-style thin
 * controller calling into this + an authorization check) — see
 * certificate.controller.js's downloadCertificate, which decides who's
 * allowed to reach this function at all.
 */
const buildCertificatePdf = async (certificate) => {
  const qrDataUrl = await generateQrDataUrl(
    `${getPrimaryClientUrl()}/verify/certificate/${certificate.verification_token}`
  );

  return generateCertificatePdfBuffer({
    employeeName: certificate.employee_name,
    eventTitle: certificate.event_title,
    eventDate: certificate.event_date,
    organizerName: ORGANIZER_NAME,
    certificateNumber: certificate.certificate_number,
    issuedAt: certificate.issued_at,
    qrDataUrl,
  });
};

module.exports = {
  getOrCreateCertificateForRegistration,
  getMyCertificate,
  listMyCertificates,
  listAllCertificates,
  getCertificateDetailForAdmin,
  revokeCertificate,
  verifyByToken,
  buildCertificatePdf,
};
