const scheduleService = require('../services/schedule.service');

const createSession = async (req, res, next) => {
  try {
    const session = await scheduleService.createSession(req.params.eventId, req.body);
    res.status(201).json({ success: true, message: 'Session added', data: { session } });
  } catch (err) {
    next(err);
  }
};

const listSessions = async (req, res, next) => {
  try {
    const sessions = await scheduleService.listSessionsForEvent(req.params.eventId, req.user.role);
    res.status(200).json({ success: true, data: { sessions } });
  } catch (err) {
    next(err);
  }
};

const updateSession = async (req, res, next) => {
  try {
    const session = await scheduleService.updateSession(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Session updated', data: { session } });
  } catch (err) {
    next(err);
  }
};

const deleteSession = async (req, res, next) => {
  try {
    await scheduleService.deleteSession(req.params.id);
    res.status(200).json({ success: true, message: 'Session deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createSession, listSessions, updateSession, deleteSession };
