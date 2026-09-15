import axiosClient from './axiosClient';

export const listSpeakers = (eventId) =>
  axiosClient.get(`/events/${eventId}/speakers`).then((res) => res.data.data.speakers);

export const createSpeaker = (eventId, payload) =>
  axiosClient.post(`/events/${eventId}/speakers`, payload).then((res) => res.data.data.speaker);

export const updateSpeaker = (speakerId, payload) =>
  axiosClient.put(`/speakers/${speakerId}`, payload).then((res) => res.data.data.speaker);

export const deleteSpeaker = (speakerId) => axiosClient.delete(`/speakers/${speakerId}`);
