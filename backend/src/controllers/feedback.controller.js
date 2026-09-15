const feedbackService = require('../services/feedback.service');

const submitFeedback = async (req, res, next) => {
  try {
    // req.user.id (from the verified JWT) is the ONLY source of identity
    // used here — nothing from req.body is ever treated as "who this
    // feedback belongs to".
    const feedback = await feedbackService.submitFeedback(req.params.eventId, req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Feedback submitted', data: { feedback } });
  } catch (err) {
    next(err);
  }
};

const getMyFeedback = async (req, res, next) => {
  try {
    const feedback = await feedbackService.getMyFeedback(req.params.eventId, req.user.id);
    res.status(200).json({ success: true, data: { feedback } });
  } catch (err) {
    next(err);
  }
};

const listFeedbackForEvent = async (req, res, next) => {
  try {
    const feedback = await feedbackService.listFeedbackForEvent(req.params.eventId);
    res.status(200).json({ success: true, data: { feedback } });
  } catch (err) {
    next(err);
  }
};

const getFeedbackSummary = async (req, res, next) => {
  try {
    const summary = await feedbackService.getFeedbackSummary(req.params.eventId);
    res.status(200).json({ success: true, data: { summary } });
  } catch (err) {
    next(err);
  }
};

module.exports = { submitFeedback, getMyFeedback, listFeedbackForEvent, getFeedbackSummary };
