import axiosClient from './axiosClient';

export const getAdminDashboard = (params = {}) =>
  axiosClient.get('/admin/dashboard', { params }).then((res) => res.data.data);
