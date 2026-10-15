import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import ConfirmModal from '../../components/ConfirmModal';
import QrModal from '../../components/QrModal';
import { listMyRegistrations, cancelRegistration } from '../../api/registrationsApi';
import { useToast } from '../../context/ToastContext';

const REGISTRATION_STATUS_STYLES = {
  REGISTERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  CHECKED_IN: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-slate-100 text-slate-600',
};

function RegistrationStatusBadge({ status }) {
  return (
    <span
      className={`inline-block rounded-full text-xs font-medium px-2.5 py-1 ${
        REGISTRATION_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
      }`}
    >
      {status}
    </span>
  );
}

function MyRegistrationsPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const status = searchParams.get('status') || '';

  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [cancelTarget, setCancelTarget] = useState(null); // registration object pending cancellation
  const [qrTarget, setQrTarget] = useState(null); // registration id currently shown in the QR modal

  const fetchRegistrations = useCallback(() => {
    setLoadState('loading');
    listMyRegistrations({ page, limit: 10, status: status || undefined })
      .then((result) => {
        setData(result);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, [page, status]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const updateParams = (next) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      Object.entries(next).forEach(([key, value]) => {
        if (value) params.set(key, value);
        else params.delete(key);
      });
      return params;
    });
  };

  const handleConfirmCancel = async () => {
    try {
      await cancelRegistration(cancelTarget.id);
      showToast('Registration cancelled');
      fetchRegistrations();
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to cancel registration', 'error');
    } finally {
      setCancelTarget(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-slate-800">My Registrations</h1>
          <select
            value={status}
            onChange={(e) => updateParams({ status: e.target.value, page: '1' })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">All statuses</option>
            <option value="REGISTERED">Registered</option>
            <option value="CHECKED_IN">Checked In</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {loadState === 'loading' && <Spinner label="Loading your registrations..." />}

        {loadState === 'error' && (
          <EmptyState title="Couldn't load your registrations" description="Please try again." />
        )}

        {loadState === 'ready' && data.registrations.length === 0 && (
          <EmptyState
            title="No registrations yet"
            description="Browse events and register to see them here."
            action={
              <Link
                to="/employee/events"
                className="text-sm font-medium text-indigo-600 hover:underline"
              >
                Browse events →
              </Link>
            }
          />
        )}

        {loadState === 'ready' && data.registrations.length > 0 && (
          <div className="space-y-3">
            {data.registrations.map((reg) => (
              <div key={reg.id} className="bg-white rounded-2xl shadow-sm p-5 flex items-start justify-between">
                <div>
                  <Link
                    to={`/employee/events/${reg.event.id}`}
                    className="font-semibold text-slate-800 hover:text-indigo-600"
                  >
                    {reg.event.title}
                  </Link>
                  <p className="text-sm text-slate-500 mt-1">
                    {reg.event.venue} &middot;{' '}
                    {new Date(reg.event.eventDate).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">Seat {reg.seatLabel}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <RegistrationStatusBadge status={reg.status} />
                  {reg.status !== 'CANCELLED' && (
                    <button
                      onClick={() => setQrTarget(reg.id)}
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      View QR
                    </button>
                  )}
                  {reg.status === 'REGISTERED' && (
                    <button
                      onClick={() => setCancelTarget(reg)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
            <Pagination pagination={data.pagination} onPageChange={(p) => updateParams({ page: String(p) })} />
          </div>
        )}
      </main>

      <ConfirmModal
        open={!!cancelTarget}
        title="Cancel this registration?"
        message={`This will free up seat ${cancelTarget?.seatLabel} on "${cancelTarget?.event?.title}" for someone else.`}
        confirmLabel="Cancel Registration"
        danger
        onCancel={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
      />

      <QrModal open={!!qrTarget} registrationId={qrTarget} onClose={() => setQrTarget(null)} />
    </div>
  );
}

export default MyRegistrationsPage;
