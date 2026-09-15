const certificateService = require('../services/certificate.service');
const certificateModel = require('../models/certificate.model');
const ApiError = require('../utils/ApiError');

const getOrCreateMyCertificate = async (req, res, next) => {
  try {
    const certificate = await certificateService.getOrCreateCertificateForRegistration(
      req.params.registrationId,
      req.user
    );
    res.status(200).json({ success: true, data: { certificate } });
  } catch (err) {
    next(err);
  }
};

const adminGenerateCertificate = async (req, res, next) => {
  try {
    // Passing `null` here is what tells the service to skip the
    // ownership check — an admin is allowed to generate a certificate
    // for ANY eligible registration, not just their own (admins don't
    // even have registrations of their own).
    const certificate = await certificateService.getOrCreateCertificateForRegistration(
      req.params.registrationId,
      null
    );
    res.status(200).json({ success: true, data: { certificate } });
  } catch (err) {
    next(err);
  }
};

const listMyCertificates = async (req, res, next) => {
  try {
    const certificates = await certificateService.listMyCertificates(req.user.id);
    res.status(200).json({ success: true, data: { certificates } });
  } catch (err) {
    next(err);
  }
};

const listAllCertificates = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const status = ['VALID', 'REVOKED'].includes(req.query.status) ? req.query.status : undefined;
    const eventId = req.query.eventId || undefined;

    const result = await certificateService.listAllCertificates({ page, limit, status, eventId });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getCertificateDetail = async (req, res, next) => {
  try {
    const certificate = await certificateService.getCertificateDetailForAdmin(req.params.certificateId);
    res.status(200).json({ success: true, data: { certificate } });
  } catch (err) {
    next(err);
  }
};

const revokeCertificate = async (req, res, next) => {
  try {
    const certificate = await certificateService.revokeCertificate(req.params.certificateId);
    res.status(200).json({ success: true, message: 'Certificate revoked', data: { certificate } });
  } catch (err) {
    next(err);
  }
};

/**
 * Public — no authentication. Only ever returns the safe, limited fields
 * verifyByToken produces; never the raw token, never PII beyond a display
 * name, never anything about the employee's account.
 */
const verifyCertificate = async (req, res, next) => {
  try {
    const result = await certificateService.verifyByToken(req.params.verificationToken);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * Streams the PDF directly in the response — never writes to disk, never
 * exposes a filesystem path. Ownership is enforced here (thin
 * authorization check) before calling into the service to build the PDF:
 *   - admin: always allowed
 *   - owning employee: allowed, UNLESS the certificate is revoked (a
 *     revoked certificate is no longer considered a valid document an
 *     employee should be able to keep re-downloading/circulating)
 *   - any other employee: 403 (IDOR blocked)
 */
const downloadCertificate = async (req, res, next) => {
  try {
    const certificate = await certificateModel.findById(req.params.certificateId);
    if (!certificate) {
      throw new ApiError(404, 'Certificate not found');
    }

    const isOwner = certificate.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new ApiError(403, 'You can only download your own certificate');
    }

    if (certificate.revoked_at && !isAdmin) {
      throw new ApiError(409, 'This certificate has been revoked and can no longer be downloaded');
    }

    const pdfBuffer = await certificateService.buildCertificatePdf(certificate);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${certificate.certificate_number}.pdf"`
    );
    res.status(200).send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOrCreateMyCertificate,
  adminGenerateCertificate,
  listMyCertificates,
  listAllCertificates,
  getCertificateDetail,
  revokeCertificate,
  verifyCertificate,
  downloadCertificate,
};
