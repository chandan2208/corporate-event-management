const speakerService = require('../services/speaker.service');

const createSpeaker = async (req, res, next) => {
  try {
    const speaker = await speakerService.createSpeaker(req.params.eventId, req.body);
    res.status(201).json({ success: true, message: 'Speaker added', data: { speaker } });
  } catch (err) {
    next(err);
  }
};

const listSpeakers = async (req, res, next) => {
  try {
    const speakers = await speakerService.listSpeakersForEvent(req.params.eventId, req.user.role);
    res.status(200).json({ success: true, data: { speakers } });
  } catch (err) {
    next(err);
  }
};

const updateSpeaker = async (req, res, next) => {
  try {
    const speaker = await speakerService.updateSpeaker(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Speaker updated', data: { speaker } });
  } catch (err) {
    next(err);
  }
};

const deleteSpeaker = async (req, res, next) => {
  try {
    await speakerService.deleteSpeaker(req.params.id);
    res.status(200).json({ success: true, message: 'Speaker deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createSpeaker, listSpeakers, updateSpeaker, deleteSpeaker };
