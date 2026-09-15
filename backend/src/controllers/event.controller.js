const eventService = require('../services/event.service');

/**
 * Parses and sanity-clamps pagination/sort query params shared by both the
 * admin and employee list endpoints. Never trusts the client's page/limit
 * blindly — a limit of 100000 could be used to try to dump the whole table
 * in one request.
 */
const parseListQuery = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100);
  const search = query.search?.trim() || undefined;
  const sortBy = query.sortBy;
  const order = query.order;
  return { page, limit, search, sortBy, order };
};

const createEvent = async (req, res, next) => {
  try {
    const event = await eventService.createEvent(req.body, req.user.id);
    res.status(201).json({ success: true, message: 'Event created', data: { event } });
  } catch (err) {
    next(err);
  }
};

/**
 * Single GET /api/events endpoint, but the dataset differs by role:
 *   - admin: sees every event, can filter by any status
 *   - employee: only ever sees PUBLISHED events, regardless of what
 *     status query param they send (the service hard-enforces this)
 */
const listEvents = async (req, res, next) => {
  try {
    const listParams = parseListQuery(req.query);

    let result;
    if (req.user.role === 'admin') {
      const status = req.query.status || undefined;
      result = await eventService.listEventsForAdmin({ ...listParams, status });
    } else {
      result = await eventService.listPublishedEventsForEmployee(listParams);
    }

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getEvent = async (req, res, next) => {
  try {
    const event = await eventService.getEventById(req.params.id, req.user.role);
    res.status(200).json({ success: true, data: { event } });
  } catch (err) {
    next(err);
  }
};

const updateEvent = async (req, res, next) => {
  try {
    const event = await eventService.updateEvent(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Event updated', data: { event } });
  } catch (err) {
    next(err);
  }
};

const changeStatus = async (req, res, next) => {
  try {
    const event = await eventService.changeStatus(req.params.id, req.body.status);
    res.status(200).json({
      success: true,
      message: `Event status changed to ${event.status}`,
      data: { event },
    });
  } catch (err) {
    next(err);
  }
};

const deleteEvent = async (req, res, next) => {
  try {
    await eventService.deleteEvent(req.params.id);
    res.status(200).json({ success: true, message: 'Event deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createEvent, listEvents, getEvent, updateEvent, changeStatus, deleteEvent };
