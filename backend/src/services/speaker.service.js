const ApiError = require('../utils/ApiError');
const speakerModel = require('../models/speaker.model');
const eventModel = require('../models/event.model');
const { getVisibleEventOrThrow, assertEventModifiable } = require('../utils/eventAccess');

const toPublicSpeaker = (row) => ({
  id: row.id,
  eventId: row.event_id,
  name: row.name,
  designation: row.designation,
  company: row.company,
  bio: row.bio,
  photoUrl: row.photo_url,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const createSpeaker = async (eventId, data) => {
  const event = await eventModel.findById(eventId);
  if (!event) {
    throw new ApiError(404, 'Event not found');
  }
  assertEventModifiable(event, 'speakers');

  const speaker = await speakerModel.createSpeaker(eventId, data);
  return toPublicSpeaker(speaker);
};

const listSpeakersForEvent = async (eventId, requestingRole) => {
  await getVisibleEventOrThrow(eventId, requestingRole);
  const speakers = await speakerModel.listByEvent(eventId);
  return speakers.map(toPublicSpeaker);
};

const updateSpeaker = async (speakerId, data) => {
  const speaker = await speakerModel.findById(speakerId);
  if (!speaker) {
    throw new ApiError(404, 'Speaker not found');
  }

  const event = await eventModel.findById(speaker.event_id);
  assertEventModifiable(event, 'speakers');

  const updated = await speakerModel.updateSpeaker(speakerId, data);
  return toPublicSpeaker(updated);
};

/**
 * Deleting a speaker does NOT delete any schedule sessions that reference
 * them (see the migration's ON DELETE SET NULL) — a session like "Panel
 * Discussion" remains a valid agenda item even if its speaker is removed;
 * it simply no longer shows a named speaker.
 */
const deleteSpeaker = async (speakerId) => {
  const speaker = await speakerModel.findById(speakerId);
  if (!speaker) {
    throw new ApiError(404, 'Speaker not found');
  }

  const event = await eventModel.findById(speaker.event_id);
  assertEventModifiable(event, 'speakers');

  await speakerModel.deleteSpeaker(speakerId);
};

module.exports = {
  createSpeaker,
  listSpeakersForEvent,
  updateSpeaker,
  deleteSpeaker,
};
