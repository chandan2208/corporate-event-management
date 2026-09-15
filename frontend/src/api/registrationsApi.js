import axiosClient from './axiosClient';

export const registerForEvent = (eventId) =>
  axiosClient.post(`/events/${eventId}/register`).then((res) => res.data.data.registration);

export const getMyRegistrationForEvent = (eventId) =>
  axiosClient.get(`/events/${eventId}/registration`).then((res) => res.data.data.registration);

export const listMyRegistrations = (params = {}) =>
  axiosClient.get('/my-registrations', { params }).then((res) => res.data.data);

export const cancelRegistration = (registrationId) =>
  axiosClient.delete(`/registrations/${registrationId}`).then((res) => res.data.data.registration);

export const getRegistrationQr = (registrationId) =>
  axiosClient.get(`/registrations/${registrationId}/qr`).then((res) => res.data.data.qrCode);
