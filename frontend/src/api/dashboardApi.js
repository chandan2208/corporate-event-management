import axiosClient from './axiosClient';

export const getEmployeeDashboard = () =>
  axiosClient.get('/employee/dashboard').then((res) => res.data.data);
