const registrationService = require('../services/registration.service');

const register = async (req, res, next) => {
  try {
    const registration = await registrationService.registerForEvent(
      req.params.eventId,
      req.user.id
    );
    res.status(201).json({
      success: true,
      message: `Registered successfully — seat ${registration.seatLabel}`,
      data: { registration },
    });
  } catch (err) {
    next(err);
  }
};

const getMyRegistrationForEvent = async (req, res, next) => {
  try {
    const registration = await registrationService.getMyRegistrationForEvent(
      req.params.eventId,
      req.user.id
    );
    res.status(200).json({ success: true, data: { registration } });
  } catch (err) {
    next(err);
  }
};

const listMyRegistrations = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const status = req.query.status || undefined;

    const result = await registrationService.listMyRegistrations(req.user.id, {
      page,
      limit,
      status,
    });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const cancelRegistration = async (req, res, next) => {
  try {
    const registration = await registrationService.cancelRegistration(
      req.params.id,
      req.user
    );
    res.status(200).json({
      success: true,
      message: 'Registration cancelled',
      data: { registration },
    });
  } catch (err) {
    next(err);
  }
};

const getQrCode = async (req, res, next) => {
  try {
    // req.user comes from the verified JWT (see authenticate middleware) —
    // the registration id in the URL is only a lookup key, never treated
    // as an identity claim.
    const qrCode = await registrationService.getRegistrationQr(req.params.id, req.user);
    res.status(200).json({ success: true, data: { qrCode } });
  } catch (err) {
    next(err);
  }
};

const checkIn = async (req, res, next) => {
  try {
    // req.body.token is only ever used as a LOOKUP KEY (find the
    // registration it belongs to) — admin identity/authorization comes
    // entirely from req.user, set by the authenticate+authorize('admin')
    // middleware chain from the verified JWT, never from anything in this
    // request body.
    const registration = await registrationService.checkInByToken(req.body.token);
    res.status(200).json({
      success: true,
      data: { registration },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  getMyRegistrationForEvent,
  listMyRegistrations,
  cancelRegistration,
  getQrCode,
  checkIn,
};
