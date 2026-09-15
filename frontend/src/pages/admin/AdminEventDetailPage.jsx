import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';
import ConfirmModal from '../../components/ConfirmModal';
import SpeakersSection from '../../components/SpeakersSection';
import ScheduleSection from '../../components/ScheduleSection';
import AdminFeedbackSection from '../../components/AdminFeedbackSection';
import { getEvent, changeEventStatus, deleteEvent } from '../../api/eventsApi';
import { useToast } from '../../context/ToastContext';

// Mirrors the backend's state machine, for UI purposes only — the backend
// is the real source of truth and re-validates every transition itself.
// PUBLISHED -> DRAFT is intentionally not offered: once published, an
// event can only move forward to CANCELLED or COMPLETED.
const NEXT_STATUS_ACTIONS = {
  DRAFT: [
    { status: 'PUBLISHED', label: 'Publish Event', danger: false },
    { status: 'CANCELLED', label: 'Cancel Event', danger: true },
  ],
  PUBLISHED: [
    { status: 'COMPLETED', label: 'Mark as Completed', danger: false },
    { status: 'CANCELLED', label: 'Cancel Event', danger: true },
  ],
  CANCELLED: [],
  COMPLETED: [],
};

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${m} ${period}`;
}

function AdminEventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [event, setEvent] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [pendingAction, setPendingAction] = useState(null); // { type: 'status'|'delete', status? }
  const [actionLoading, setActionLoading] = useState(false);

  const fetchEvent = () => {
    setLoadState('loading');
    getEvent(id)
      .then((data) => {
        setEvent(data);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  };

  useEffect(() => {
    fetchEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleConfirmStatusChange = async () => {
    setActionLoading(true);
    try {
      const updated = await changeEventStatus(id, pendingAction.status);
      setEvent(updated);
      showToast(`Event status changed to ${updated.status}`);
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to update status', 'error');
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  };

  const handleConfirmDelete = async () => {
    setActionLoading(true);
    try {
      await deleteEvent(id);
      showToast('Event deleted');
      navigate('/admin/events');
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to delete event', 'error');
      setActionLoading(false);
      setPendingAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link to="/admin/events" className="text-sm text-indigo-600 hover:underline">
          &larr; Back to events
        </Link>

        {loadState === 'loading' && <Spinner label="Loading event..." />}

        {loadState === 'error' && (
          <p className="text-sm text-red-600 mt-4">Event not found.</p>
        )}

        {loadState === 'ready' && event && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mt-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-semibold text-slate-800">{event.title}</h1>
                <p className="text-sm text-slate-500 mt-1">{event.venue}</p>
              </div>
              <StatusBadge status={event.status} />
            </div>

            {event.description && (
              <p className="text-sm text-slate-600 mt-4">{event.description}</p>
            )}

            <dl className="grid grid-cols-2 gap-4 mt-6 text-sm">
              <div>
                <dt className="text-slate-400">Date</dt>
                <dd className="text-slate-700 font-medium">
                  {new Date(event.eventDate).toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Time</dt>
                <dd className="text-slate-700 font-medium">
                  {formatTime(event.startTime)} &ndash; {formatTime(event.endTime)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Capacity</dt>
                <dd className="text-slate-700 font-medium">{event.capacity} seats</dd>
              </div>
              <div>
                <dt className="text-slate-400">Registration Deadline</dt>
                <dd className="text-slate-700 font-medium">
                  {new Date(event.registrationDeadline).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Created By</dt>
                <dd className="text-slate-700 font-medium">{event.createdByName}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-slate-100">
              {['DRAFT', 'PUBLISHED'].includes(event.status) && (
                <Link
                  to={`/admin/events/${event.id}/edit`}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300
                    hover:bg-slate-50"
                >
                  Edit
                </Link>
              )}

              {NEXT_STATUS_ACTIONS[event.status].map((action) => (
                <button
                  key={action.status}
                  onClick={() => setPendingAction({ type: 'status', status: action.status })}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border ${
                    action.danger
                      ? 'border-red-200 text-red-600 hover:bg-red-50'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {action.label}
                </button>
              ))}

              {event.status === 'DRAFT' && (
                <button
                  onClick={() => setPendingAction({ type: 'delete' })}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-red-200
                    text-red-600 hover:bg-red-50 ml-auto"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}

        {loadState === 'ready' && event && (
          <div className="space-y-4 mt-4">
            <SpeakersSection eventId={event.id} isAdmin />
            <ScheduleSection eventId={event.id} isAdmin />
            {['PUBLISHED', 'COMPLETED'].includes(event.status) && (
              <AdminFeedbackSection eventId={event.id} />
            )}
          </div>
        )}
      </main>

      <ConfirmModal
        open={!!pendingAction && !actionLoading}
        title={pendingAction?.type === 'delete' ? 'Delete this event?' : 'Change event status?'}
        message={
          pendingAction?.type === 'delete'
            ? 'This permanently deletes the draft event. This cannot be undone.'
            : `This will change the event status to ${pendingAction?.status}.`
        }
        confirmLabel={pendingAction?.type === 'delete' ? 'Delete' : 'Confirm'}
        danger={pendingAction?.type === 'delete' || pendingAction?.status === 'CANCELLED'}
        onCancel={() => setPendingAction(null)}
        onConfirm={pendingAction?.type === 'delete' ? handleConfirmDelete : handleConfirmStatusChange}
      />

      {actionLoading && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-40">
          <Spinner label="Please wait..." />
        </div>
      )}
    </div>
  );
}

export default AdminEventDetailPage;
