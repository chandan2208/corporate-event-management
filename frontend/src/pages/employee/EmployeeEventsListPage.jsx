import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { listEvents } from '../../api/eventsApi';

function EmployeeEventsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const search = searchParams.get('search') || '';

  const [searchInput, setSearchInput] = useState(search);
  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchEvents = useCallback(() => {
    setLoadState('loading');
    // No `status` param is sent — the backend already restricts employees
    // to PUBLISHED events regardless of what's requested.
    listEvents({ page, limit: 9, search: search || undefined })
      .then((result) => {
        setData(result);
        setLoadState('ready');
      })
      .catch((err) => {
        setErrorMessage(err.response?.data?.error?.message || 'Failed to load events.');
        setLoadState('error');
      });
  }, [page, search]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (searchInput) params.set('search', searchInput);
      else params.delete('search');
      params.set('page', '1');
      return params;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-lg font-semibold text-slate-800 mb-1">Upcoming Events</h1>
        <p className="text-sm text-slate-500 mb-6">Browse and view published company events</p>

        <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-6 max-w-md">
          <input
            type="text"
            placeholder="Search events..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 bg-white"
          >
            Search
          </button>
        </form>

        {loadState === 'loading' && <Spinner label="Loading events..." />}

        {loadState === 'error' && (
          <EmptyState title="Couldn't load events" description={errorMessage} />
        )}

        {loadState === 'ready' && data.events.length === 0 && (
          <EmptyState
            title="No events found"
            description={
              search
                ? 'Try a different search term.'
                : 'There are no published events right now — check back soon.'
            }
          />
        )}

        {loadState === 'ready' && data.events.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.events.map((event) => (
                <Link
                  key={event.id}
                  to={`/employee/events/${event.id}`}
                  className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow"
                >
                  <h3 className="font-semibold text-slate-800">{event.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">{event.venue}</p>
                  <p className="text-sm text-indigo-600 font-medium mt-3">
                    {new Date(event.eventDate).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{event.capacity} seats total</p>
                </Link>
              ))}
            </div>
            <Pagination
              pagination={data.pagination}
              onPageChange={(p) =>
                setSearchParams((prev) => {
                  const params = new URLSearchParams(prev);
                  params.set('page', String(p));
                  return params;
                })
              }
            />
          </>
        )}
      </main>
    </div>
  );
}

export default EmployeeEventsListPage;
