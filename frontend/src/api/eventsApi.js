import axiosClient from './axiosClient';

/**
 * Thin wrappers around each event endpoint. The backend's single
 * GET /events endpoint already returns different data depending on the
 * caller's role (admin vs employee) — the frontend doesn't need to know
 * which, it just calls listEvents() and renders whatever comes back.
 */

export const listEvents = (params = {}) =>
  axiosClient.get('/events', { params }).then((res) => res.data.data);

export const getEvent = (id) =>
  axiosClient.get(`/events/${id}`).then((res) => res.data.data.event);

export const createEvent = (payload) =>
  axiosClient.post('/events', payload).then((res) => res.data.data.event);

export const updateEvent = (id, payload) =>
  axiosClient.put(`/events/${id}`, payload).then((res) => res.data.data.event);

export const changeEventStatus = (id, status) =>
  axiosClient.patch(`/events/${id}/status`, { status }).then((res) => res.data.data.event);

export const deleteEvent = (id) => axiosClient.delete(`/events/${id}`);
