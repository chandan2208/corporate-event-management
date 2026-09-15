import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';
import ConfirmModal from '../../components/ConfirmModal';
import QrCodeCard from '../../components/QrCodeCard';
import SpeakersSection from '../../components/SpeakersSection';
import ScheduleSection from '../../components/ScheduleSection';
import FeedbackSection from '../../components/FeedbackSection';
import CertificateAvailability from '../../components/CertificateAvailability';
import { getEvent } from '../../api/eventsApi';
import {
  registerForEvent,
  getMyRegistrationForEvent,
  cancelRegistration,
} from '../../api/registrationsApi';
import { useToast } from '../../context/ToastContext';

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${m} ${period}`;
}

function EmployeeEventDetailPage() {
  const { id } = useParams();
  const { showToast } = useToast();

  const [event, setEvent] = useState(null);
  const [registration, setRegistration] = useState(null); // null = not registered
  const [loadState, setLoadState] = useState('loading');
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const loadEverything = async () => {
    setLoadState('loading');
    try {
      const eventData = await getEvent(id);
      setEvent(eventData);

      try {
        const reg = await getMyRegistrationForEvent(id);
        setRegistration(reg);
      } catch {
        // 404 here just means "not registered yet" — not an error state.
        setRegistration(null);
      }

      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  };

  useEffect(() => {
    loadEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const deadlinePassed = event && new Date(event.registrationDeadline) < new Date();
  const canRegister = event && event.status === 'PUBLISHED' && !deadlinePassed && !registration;

  const handleRegister = async () => {
    setRegisterError('');
    setRegistering(true);
    try {
      const reg = await registerForEvent(id);
      setRegistration(reg);
      showToast(`Registered! Your seat is ${reg.seatLabel}`);
    } catch (err) {
      setRegisterError(
        err.response?.data?.error?.message || 'Registration failed. Please try again.'
      );
    } finally {
      setRegistering(false);
    }
  };

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      await cancelRegistration(registration.id);
      setRegistration(null);
      showToast('Registration cancelled');
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to cancel registration', 'error');
    } finally {
      setCancelling(false);
      setConfirmCancelOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link to="/employee/events" className="text-sm text-indigo-600 hover:underline">
          &larr; Back to events
        </Link>

        {loadState === 'loading' && <Spinner label="Loading event..." />}

        {loadState === 'error' && (
          <p className="text-sm text-red-600 mt-4">
            This event could not be found, or is no longer available.
          </p>
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
                <dd className="text-slate-700 font-medium">{event.capacity} seats total</dd>
              </div>
              <div>
                <dt className="text-slate-400">Registration Deadline</dt>
                <dd className={`font-medium ${deadlinePassed ? 'text-red-600' : 'text-slate-700'}`}>
                  {new Date(event.registrationDeadline).toLocaleString()}
                  {deadlinePassed && ' (closed)'}
                </dd>
              </div>
            </dl>

            <div className="mt-6 pt-6 border-t border-slate-100">
              {registration ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-green-800">
                    You're registered — seat {registration.seatLabel}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Status: {registration.status} &middot; Registered{' '}
                    {new Date(registration.registeredAt).toLocaleDateString()}
                  </p>
                  {registration.status !== 'CANCELLED' && (
                    <div className="mt-4 bg-white rounded-xl p-4">
                      <QrCodeCard registrationId={registration.id} />
                    </div>
                  )}
                  {registration.status === 'REGISTERED' && (
                    <button
                      onClick={() => setConfirmCancelOpen(true)}
                      className="mt-3 text-sm font-medium text-red-600 hover:underline"
                    >
                      Cancel my registration
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {registerError && (
                    <p className="text-sm text-red-600 mb-2">{registerError}</p>
                  )}
                  <button
                    onClick={handleRegister}
                    disabled={!canRegister || registering}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white
                      hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {registering
                      ? 'Registering...'
                      : deadlinePassed
                        ? 'Registration Closed'
                        : event.status !== 'PUBLISHED'
                          ? 'Not Open for Registration'
                          : 'Register for this Event'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {loadState === 'ready' && event && (
          <div className="space-y-4 mt-4">
            <SpeakersSection eventId={event.id} isAdmin={false} />
            <ScheduleSection eventId={event.id} isAdmin={false} />
            {['PUBLISHED', 'COMPLETED'].includes(event.status) && (
              <FeedbackSection eventId={event.id} registrationStatus={registration?.status} />
            )}
            {registration && (
              <CertificateAvailability
                registrationId={registration.id}
                registrationStatus={registration.status}
              />
            )}
          </div>
        )}
      </main>

      <ConfirmModal
        open={confirmCancelOpen}
        title="Cancel your registration?"
        message={`This will free up seat ${registration?.seatLabel} for someone else. You can register again later if seats remain.`}
        confirmLabel="Cancel Registration"
        danger
        onCancel={() => setConfirmCancelOpen(false)}
        onConfirm={handleConfirmCancel}
      />

      {cancelling && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-40">
          <Spinner label="Cancelling..." />
        </div>
      )}
    </div>
  );
}

export default EmployeeEventDetailPage;
