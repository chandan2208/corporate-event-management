import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TopBar from '../components/TopBar';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import QrModal from '../components/QrModal';
import { getEmployeeDashboard } from '../api/dashboardApi';

const REG_STATUS_STYLES = {
  REGISTERED: 'bg-green-100 text-green-700',
  CHECKED_IN: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-red-100 text-red-700',
};

function RegBadge({ status }) {
  return (
    <span className={`inline-block rounded-full text-xs font-medium px-2.5 py-1 ${REG_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <p className="text-3xl font-bold text-slate-800">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${m} ${period}`;
}

function EmployeeDashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [qrRegistrationId, setQrRegistrationId] = useState(null);

  const fetchDashboard = () => {
    setLoadState('loading');
    getEmployeeDashboard()
      .then((data) => {
        setDashboard(data);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h1 className="text-lg font-semibold text-slate-800">
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {loadState === 'loading' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <Spinner label="Loading your dashboard..." />
          </div>
        )}

        {loadState === 'error' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <EmptyState
              title="Couldn't load your dashboard"
              description="Something went wrong fetching your data."
              action={
                <button onClick={fetchDashboard} className="text-sm font-medium text-indigo-600 hover:underline">
                  Try again
                </button>
              }
            />
          </div>
        )}

        {loadState === 'ready' && dashboard && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <SummaryCard label="Upcoming Events" value={dashboard.summary.upcomingEvents} />
              <SummaryCard label="Registered Events" value={dashboard.summary.registeredEvents} />
              <SummaryCard label="Events Attended" value={dashboard.summary.attendedEvents} />
              <SummaryCard label="Certificates Available" value={dashboard.summary.certificatesAvailable} />
              <SummaryCard label="Feedback Pending" value={dashboard.summary.feedbackPending} />
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-4">Upcoming Events</h2>
              {dashboard.upcomingEvents.length === 0 ? (
                <EmptyState
                  title="No upcoming events"
                  description="Browse published events to register."
                  action={
                    <Link to="/employee/events" className="text-sm font-medium text-indigo-600 hover:underline">
                      Browse events →
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {dashboard.upcomingEvents.map((r) => (
                    <div key={r.registrationId} className="border border-slate-100 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <Link to={`/employee/events/${r.event.id}`} className="font-medium text-slate-800 hover:text-indigo-600">
                            {r.event.title}
                          </Link>
                          <p className="text-sm text-slate-500 mt-1">
                            {r.event.venue} &middot;{' '}
                            {new Date(r.event.eventDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}{' '}
                            &middot; {formatTime(r.event.startTime)}&ndash;{formatTime(r.event.endTime)}
                          </p>
                          {r.seatLabel && <p className="text-sm text-slate-500 mt-1">Seat: {r.seatLabel}</p>}
                        </div>
                        <RegBadge status={r.status} />
                      </div>

                      {r.schedule.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                          {r.schedule.slice(0, 3).map((s, i) => (
                            <p key={i} className="text-xs text-slate-500">
                              {formatTime(s.startTime)} — {s.title}
                              {s.speakerName && ` (${s.speakerName})`}
                            </p>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100">
                        <Link to={`/employee/events/${r.event.id}`} className="text-xs font-medium text-indigo-600 hover:underline">
                          View Event
                        </Link>
                        {r.qrAvailable && (
                          <button
                            onClick={() => setQrRegistrationId(r.registrationId)}
                            className="text-xs font-medium text-indigo-600 hover:underline"
                          >
                            View QR
                          </button>
                        )}
                        {r.feedbackEligible && !r.feedbackSubmitted && (
                          <Link to={`/employee/events/${r.event.id}`} className="text-xs font-medium text-amber-600 hover:underline">
                            Give Feedback
                          </Link>
                        )}
                        {r.feedbackSubmitted && <span className="text-xs text-slate-400">Feedback submitted</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800">My Registrations</h2>
                <Link to="/employee/my-registrations" className="text-sm text-indigo-600 hover:underline">
                  View all →
                </Link>
              </div>
              {dashboard.registrations.length === 0 ? (
                <EmptyState title="No registrations yet" />
              ) : (
                <div className="space-y-3">
                  {dashboard.registrations.slice(0, 5).map((r) => (
                    <div key={r.registrationId} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-slate-700">{r.event.title}</p>
                        <p className="text-xs text-slate-400">
                          {r.seatLabel ? `Seat ${r.seatLabel}` : 'No seat'} &middot;{' '}
                          {r.checkedInAt ? `Checked in ${new Date(r.checkedInAt).toLocaleDateString()}` : 'Not checked in'}
                        </p>
                      </div>
                      <RegBadge status={r.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800">Certificates</h2>
                <Link to="/employee/my-certificates" className="text-sm text-indigo-600 hover:underline">
                  View all →
                </Link>
              </div>
              {dashboard.certificates.length === 0 ? (
                <EmptyState title="No certificates yet" description="Certificates become available after you're checked in at an event." />
              ) : (
                <div className="space-y-2">
                  {dashboard.certificates.slice(0, 3).map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-slate-700">{c.event?.title}</p>
                        <p className="text-xs text-slate-400">
                          {c.certificateNumber} &middot; Issued {new Date(c.issuedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`inline-block rounded-full text-xs font-medium px-2.5 py-1 ${
                          c.status === 'REVOKED' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-4">Recent Activity</h2>
              {dashboard.recentActivity.length === 0 ? (
                <EmptyState title="No recent activity" />
              ) : (
                <ol className="space-y-2">
                  {dashboard.recentActivity.map((a, i) => (
                    <li key={i} className="text-sm text-slate-600 flex justify-between">
                      <span>{a.message}</span>
                      <span className="text-xs text-slate-400">{new Date(a.timestamp).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </main>

      <QrModal open={!!qrRegistrationId} registrationId={qrRegistrationId} onClose={() => setQrRegistrationId(null)} />
    </div>
  );
}

export default EmployeeDashboardPage;
