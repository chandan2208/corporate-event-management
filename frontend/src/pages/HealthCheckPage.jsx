import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';

/**
 * Temporary landing page for this setup phase only.
 * It calls GET /api/health on the backend and displays the result.
 * This page will be replaced by the real login/dashboard pages in a later phase.
 */
function HealthCheckPage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  const [data, setData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    axiosClient
      .get('/health')
      .then((response) => {
        setData(response.data.data);
        setStatus('ok');
      })
      .catch((error) => {
        // 503 = backend is up but its database is not; the body still
        // carries the status details, so show them instead of "unreachable".
        if (error.response?.status === 503 && error.response.data?.data) {
          setData(error.response.data.data);
          setStatus('ok');
          return;
        }
        setErrorMessage(
          error.response?.data?.error?.message || error.message || 'Unknown error'
        );
        setStatus('error');
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">
          Corporate Event Management System
        </h1>
        <p className="text-slate-500 mb-6">Project setup verification page</p>

        {status === 'loading' && (
          <p className="text-slate-500">Checking backend connection...</p>
        )}

        {status === 'ok' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
              <span className="font-medium text-green-700">Backend reachable</span>
            </div>
            <dl className="text-sm text-slate-600 mt-4 space-y-1">
              <div className="flex justify-between">
                <dt>Server</dt>
                <dd className="font-mono">{data.server}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Database</dt>
                <dd className="font-mono">{data.database}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Uptime</dt>
                <dd className="font-mono">{data.uptimeSeconds}s</dd>
              </div>
            </dl>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="font-medium text-red-700">Backend not reachable</span>
            </div>
            <p className="text-sm text-slate-500 mt-2">{errorMessage}</p>
            <p className="text-sm text-slate-400 mt-2">
              Make sure the backend server is running on port 5000.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default HealthCheckPage;
