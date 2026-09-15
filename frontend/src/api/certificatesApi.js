import axiosClient from './axiosClient';

export const listMyCertificates = () =>
  axiosClient.get('/my-certificates').then((res) => res.data.data.certificates);

export const getMyCertificateForRegistration = (registrationId) =>
  axiosClient
    .get(`/registrations/${registrationId}/certificate`)
    .then((res) => res.data.data.certificate);

/**
 * Downloads the PDF as a Blob so the browser can trigger a real file
 * save — the axios client's default JSON handling would otherwise try
 * (and fail) to parse binary PDF bytes as JSON.
 */
export const downloadCertificate = (certificateId) =>
  axiosClient
    .get(`/certificates/${certificateId}/download`, { responseType: 'blob' })
    .then((res) => res.data);

export const listAllCertificates = (params = {}) =>
  axiosClient.get('/admin/certificates', { params }).then((res) => res.data.data);

export const getCertificateDetail = (certificateId) =>
  axiosClient.get(`/admin/certificates/${certificateId}`).then((res) => res.data.data.certificate);

export const adminGenerateCertificate = (registrationId) =>
  axiosClient
    .post(`/admin/registrations/${registrationId}/certificate`)
    .then((res) => res.data.data.certificate);

export const revokeCertificate = (certificateId) =>
  axiosClient
    .post(`/admin/certificates/${certificateId}/revoke`)
    .then((res) => res.data.data.certificate);

/**
 * Public — no auth header needed (though the shared axiosClient will
 * still attach one if the caller happens to be logged in; the backend
 * simply ignores it for this route since it has no authenticate()
 * middleware at all).
 */
export const verifyCertificate = (verificationToken) =>
  axiosClient
    .get(`/certificates/verify/${verificationToken}`)
    .then((res) => res.data.data);
