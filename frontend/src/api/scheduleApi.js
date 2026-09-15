import axiosClient from './axiosClient';

export const listSchedule = (eventId) =>
  axiosClient.get(`/events/${eventId}/schedule`).then((res) => res.data.data.sessions);

export const createSession = (eventId, payload) =>
  axiosClient.post(`/events/${eventId}/schedule`, payload).then((res) => res.data.data.session);

export const updateSession = (sessionId, payload) =>
  axiosClient.put(`/schedule/${sessionId}`, payload).then((res) => res.data.data.session);

export const deleteSession = (sessionId) => axiosClient.delete(`/schedule/${sessionId}`);
