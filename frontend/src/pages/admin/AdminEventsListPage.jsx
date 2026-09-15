import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import { listEvents } from '../../api/eventsApi';

const STATUS_OPTIONS = ['', 'DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'];

function AdminEventsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseInt(searchParams.get('page') || '1', 10);
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';

  const [searchInput, setSearchInput] = useState(search);
  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  const fetchEvents = useCallback(() => {
    setLoadState('loading');
    listEvents({ page, limit: 10, status: status || undefined, search: search || undefined })
      .then((result) => {
        setData(result);
        setLoadState('ready');
      })
      .catch((err) => {
        setErrorMessage(err.response?.data?.error?.message || 'Failed to load events.');
        setLoadState('error');
      });
  }, [page, status, search]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

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

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    updateParams({ search: searchInput, page: '1' });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-slate-800">Events</h1>
          <Link
            to="/admin/events/new"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium
              px-4 py-2 rounded-lg"
          >
            + Create Event
          </Link>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by title or venue..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
            >
              Search
            </button>
          </form>

          <select
            value={status}
            onChange={(e) => updateParams({ status: e.target.value, page: '1' })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s || 'All statuses'}
              </option>
            ))}
          </select>
        </div>

        {loadState === 'loading' && <Spinner label="Loading events..." />}

        {loadState === 'error' && (
          <EmptyState title="Couldn't load events" description={errorMessage} />
        )}

        {loadState === 'ready' && data.events.length === 0 && (
          <EmptyState
            title="No events found"
            description={
              status || search
                ? 'Try adjusting your filters.'
                : 'Create your first event to get started.'
            }
          />
        )}

        {loadState === 'ready' && data.events.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Venue</th>
                  <th className="px-4 py-3 font-medium">Capacity</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((event) => (
                  <tr
                    key={event.id}
                    onClick={() => navigate(`/admin/events/${event.id}`)}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{event.title}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(event.eventDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{event.venue}</td>
                    <td className="px-4 py-3 text-slate-500">{event.capacity}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={event.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 pb-4">
              <Pagination
                pagination={data.pagination}
                onPageChange={(p) => updateParams({ page: String(p) })}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminEventsListPage;
