import axiosClient from './axiosClient';

export const submitFeedback = (eventId, payload) =>
  axiosClient.post(`/events/${eventId}/feedback`, payload).then((res) => res.data.data.feedback);

export const getMyFeedback = (eventId) =>
  axiosClient.get(`/events/${eventId}/feedback/me`).then((res) => res.data.data.feedback);

export const listEventFeedback = (eventId) =>
  axiosClient.get(`/admin/events/${eventId}/feedback`).then((res) => res.data.data.feedback);

export const getFeedbackSummary = (eventId) =>
  axiosClient.get(`/admin/events/${eventId}/feedback/summary`).then((res) => res.data.data.summary);
