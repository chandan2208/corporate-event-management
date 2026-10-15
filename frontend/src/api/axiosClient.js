import axios from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from './tokenStore';

/**
 * Single, shared Axios instance for the whole app.
 *
 * Every feature module (auth, events, etc.) will import THIS instead of
 * calling axios directly, so things like the base URL, auth headers, and
 * global error handling only need to be set up once, here.
 */
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  // Required so the browser sends/receives the httpOnly refresh-token
  // cookie on every request, even though it's a different origin/port
  // than the frontend during local development.
  withCredentials: true,
});

// --- Request interceptor: attach the current access token, if we have one ---
axiosClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A separate, "plain" axios instance (no interceptors) used ONLY for calling
// the refresh endpoint. Using the same `axiosClient` here would risk an
// infinite loop if the refresh call itself ever returned a 401.
const plainClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

// If several requests fail with 401 at the same time (e.g. a dashboard
// firing multiple API calls at once), we only want to hit /refresh-token
// ONCE and let every failed request wait on that same promise.
let refreshInFlight = null;

const refreshAccessToken = () => {
  if (!refreshInFlight) {
    refreshInFlight = plainClient
      .post('/auth/refresh-token')
      .then((response) => {
        const newToken = response.data.data.accessToken;
        setAccessToken(newToken);
        return newToken;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
};

// --- Response interceptor: on 401, try ONE silent refresh, then retry ---
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const isAuthEndpoint =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh-token') ||
      // Phase 15: a 401 from these means "wrong code", not "session expired".
      originalRequest.url?.includes('/auth/verify-email') ||
      originalRequest.url?.includes('/auth/resend-verification');

    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      try {
        const newToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        clearAccessToken();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
