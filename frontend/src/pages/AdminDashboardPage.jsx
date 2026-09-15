import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import TopBar from '../components/TopBar';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import { getAdminDashboard } from '../api/adminDashboardApi';

const STATUS_COLORS = {
  DRAFT: '#94a3b8',
  PUBLISHED: '#22c55e',
  CANCELLED: '#ef4444',
  COMPLETED: '#6366f1',
};

function SummaryCard({ label, value, suffix }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <p className="text-2xl font-bold text-slate-800">
        {value}
        {suffix}
      </p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function StatusBadgeSmall({ status }) {
  const styles = {
    DRAFT: 'bg-slate-100 text-slate-600',
    PUBLISHED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
    COMPLETED: 'bg-indigo-100 text-indigo-700',
  };
  return (
    <span className={`inline-block rounded-full text-xs font-medium px-2 py-0.5 ${styles[status] || 'bg-slate-100'}`}>
      {status}
    </span>
  );
}

function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [days, setDays] = useState(30);

  const fetchDashboard = (rangeDays) => {
    setLoadState('loading');
    getAdminDashboard({ days: rangeDays })
      .then((data) => {
        setDashboard(data);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  };

  useEffect(() => {
    fetchDashboard(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-800">Admin Dashboard</h1>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {loadState === 'loading' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <Spinner label="Loading analytics..." />
          </div>
        )}

        {loadState === 'error' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <EmptyState
              title="Couldn't load dashboard data"
              description="Something went wrong fetching analytics."
              action={
                <button onClick={() => fetchDashboard(days)} className="text-sm font-medium text-indigo-600 hover:underline">
                  Try again
                </button>
              }
            />
          </div>
        )}

        {loadState === 'ready' && dashboard && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
              <SummaryCard label="Total Events" value={dashboard.summary.totalEvents} />
              <SummaryCard label="Published" value={dashboard.summary.publishedEvents} />
              <SummaryCard label="Upcoming" value={dashboard.summary.upcomingEvents} />
              <SummaryCard label="Registrations" value={dashboard.summary.totalRegistrations} />
              <SummaryCard label="Attendees" value={dashboard.summary.totalAttendees} />
              <SummaryCard label="Certificates" value={dashboard.summary.certificatesIssued} />
              <SummaryCard label="Attendance Rate" value={dashboard.summary.attendanceRate} suffix="%" />
            </div>

            {/* Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-slate-800 mb-4">Registration Trend</h2>
                {dashboard.registrationTrend.every((d) => d.registrations === 0) ? (
                  <EmptyState title="No registration activity in this range" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={dashboard.registrationTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="registrations" stroke="#4f46e5" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-slate-800 mb-4">Attendance Trend</h2>
                {dashboard.attendanceTrend.every((d) => d.attendees === 0) ? (
                  <EmptyState title="No check-ins in this range" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={dashboard.attendanceTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="attendees" stroke="#22c55e" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Event status + Feedback */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-slate-800 mb-4">Event Status Distribution</h2>
                {dashboard.summary.totalEvents === 0 ? (
                  <EmptyState title="No events yet" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={dashboard.eventStatus}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(entry) => `${entry.status}: ${entry.count}`}
                      >
                        {dashboard.eventStatus.map((entry) => (
                          <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-slate-800 mb-4">Feedback Analytics</h2>
                {dashboard.feedback.total === 0 ? (
                  <EmptyState title="No feedback data yet" />
                ) : (
                  <>
                    <div className="flex items-center gap-6 mb-4">
                      <div>
                        <p className="text-3xl font-bold text-slate-800">{dashboard.feedback.averageRating}</p>
                        <p className="text-xs text-slate-400">avg / 5</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-slate-700">{dashboard.feedback.total}</p>
                        <p className="text-xs text-slate-400">responses</p>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={dashboard.feedback.distribution}>
                        <XAxis dataKey="rating" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>
            </div>

            {/* Event performance table */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-4">Event Performance</h2>
              {dashboard.eventPerformance.length === 0 ? (
                <EmptyState title="No events yet" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-slate-500 text-left border-b border-slate-100">
                      <tr>
                        <th className="py-2 pr-3 font-medium">Event</th>
                        <th className="py-2 pr-3 font-medium">Status</th>
                        <th className="py-2 pr-3 font-medium">Capacity</th>
                        <th className="py-2 pr-3 font-medium">Registrations</th>
                        <th className="py-2 pr-3 font-medium">Attendance</th>
                        <th className="py-2 pr-3 font-medium">Available</th>
                        <th className="py-2 pr-3 font-medium">Att. Rate</th>
                        <th className="py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.eventPerformance.slice(0, 10).map((e) => (
                        <tr key={e.id} className="border-b border-slate-50">
                          <td className="py-2 pr-3 font-medium text-slate-700">{e.title}</td>
                          <td className="py-2 pr-3">
                            <StatusBadgeSmall status={e.status} />
                          </td>
                          <td className="py-2 pr-3 text-slate-500">{e.capacity}</td>
                          <td className="py-2 pr-3 text-slate-500">{e.registrations}</td>
                          <td className="py-2 pr-3 text-slate-500">{e.attendance}</td>
                          <td className="py-2 pr-3 text-slate-500">{e.availableSeats}</td>
                          <td className="py-2 pr-3 text-slate-500">{e.attendanceRate}%</td>
                          <td className="py-2">
                            <Link to={`/admin/events/${e.id}`} className="text-indigo-600 hover:underline text-xs">
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Link to="/admin/events" className="text-xs text-indigo-600 hover:underline mt-3 inline-block">
                    View all events →
                  </Link>
                </div>
              )}
            </div>

            {/* Popular events + Certificates */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-slate-800 mb-4">Most Popular Events</h2>
                {dashboard.popularEvents.length === 0 ? (
                  <EmptyState title="No registrations yet" />
                ) : (
                  <ol className="space-y-2 text-sm">
                    {dashboard.popularEvents.slice(0, 5).map((e, i) => (
                      <li key={e.id} className="flex justify-between">
                        <span className="text-slate-700">
                          {i + 1}. {e.title}
                        </span>
                        <span className="text-slate-400">{e.registrations} registrations</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-slate-800 mb-4">Certificate Overview</h2>
                {dashboard.certificates.issued === 0 ? (
                  <EmptyState title="No certificates issued yet" />
                ) : (
                  <>
                    <div className="flex gap-6 mb-4 text-sm">
                      <div>
                        <p className="text-xl font-bold text-slate-800">{dashboard.certificates.issued}</p>
                        <p className="text-xs text-slate-400">Issued</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold text-green-600">{dashboard.certificates.valid}</p>
                        <p className="text-xs text-slate-400">Valid</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold text-red-600">{dashboard.certificates.revoked}</p>
                        <p className="text-xs text-slate-400">Revoked</p>
                      </div>
                    </div>
                    <Link to="/admin/certificates" className="text-xs text-indigo-600 hover:underline">
                      Manage certificates →
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Recent events */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-4">Recent Events</h2>
              {dashboard.recentEvents.length === 0 ? (
                <EmptyState title="No events yet" />
              ) : (
                <div className="space-y-2">
                  {dashboard.recentEvents.slice(0, 5).map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-sm">
                      <div>
                        <Link to={`/admin/events/${e.id}`} className="font-medium text-slate-700 hover:text-indigo-600">
                          {e.title}
                        </Link>
                        <p className="text-xs text-slate-400">
                          {new Date(e.eventDate).toLocaleDateString()} &middot; {e.registrations} registrations &middot;{' '}
                          {e.attendance} attended
                        </p>
                      </div>
                      <StatusBadgeSmall status={e.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Link to="/admin/events" className="text-sm font-medium text-indigo-600 hover:underline">
                Manage Events →
              </Link>
              <Link to="/admin/check-in" className="text-sm font-medium text-indigo-600 hover:underline">
                Event Check-in →
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default AdminDashboardPage;
