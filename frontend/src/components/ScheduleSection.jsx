import { useEffect, useState } from 'react';
import { listSchedule, createSession, updateSession, deleteSession } from '../api/scheduleApi';
import { listSpeakers } from '../api/speakersApi';
import Spinner from './Spinner';
import EmptyState from './EmptyState';
import ConfirmModal from './ConfirmModal';
import FormField from './FormField';
import { useToast } from '../context/ToastContext';

const emptySessionForm = { title: '', description: '', speakerId: '', startTime: '', endTime: '', location: '' };

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${m} ${period}`;
}

/**
 * Same pattern as SpeakersSection: `isAdmin` only controls whether
 * add/edit/delete controls render — the backend independently enforces
 * the same rule on every mutation endpoint.
 */
function ScheduleSection({ eventId, isAdmin }) {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [form, setForm] = useState(emptySessionForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchSessions = () => {
    setLoadState('loading');
    listSchedule(eventId)
      .then((data) => {
        setSessions(data);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  };

  useEffect(() => {
    fetchSessions();
    if (isAdmin) {
      listSpeakers(eventId)
        .then(setSpeakers)
        .catch(() => setSpeakers([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const openCreateForm = () => {
    setEditingSession(null);
    setForm(emptySessionForm);
    setFormError('');
    setFormOpen(true);
  };

  const openEditForm = (session) => {
    setEditingSession(session);
    setForm({
      title: session.title || '',
      description: session.description || '',
      speakerId: session.speakerId || '',
      startTime: session.startTime?.slice(0, 5) || '',
      endTime: session.endTime?.slice(0, 5) || '',
      location: session.location || '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    const payload = { ...form, speakerId: form.speakerId || null };
    try {
      if (editingSession) {
        await updateSession(editingSession.id, payload);
        showToast('Session updated');
      } else {
        await createSession(eventId, payload);
        showToast('Session added');
      }
      setFormOpen(false);
      fetchSessions();
    } catch (err) {
      setFormError(err.response?.data?.error?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteSession(deleteTarget.id);
      showToast('Session deleted');
      fetchSessions();
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to delete session', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-800">Schedule</h2>
        {isAdmin && (
          <button onClick={openCreateForm} className="text-sm font-medium text-indigo-600 hover:underline">
            + Add Session
          </button>
        )}
      </div>

      {loadState === 'loading' && <Spinner label="Loading schedule..." />}
      {loadState === 'error' && <p className="text-sm text-red-600">Could not load schedule.</p>}
      {loadState === 'ready' && sessions.length === 0 && <EmptyState title="No sessions scheduled yet" />}

      {loadState === 'ready' && sessions.length > 0 && (
        <ol className="relative border-l border-slate-200 ml-2 space-y-6">
          {sessions.map((session) => (
            <li key={session.id} className="ml-4">
              <div className="absolute w-2 h-2 bg-indigo-500 rounded-full -left-1 mt-1.5" />
              <p className="text-xs font-medium text-indigo-600">
                {formatTime(session.startTime)} – {formatTime(session.endTime)}
              </p>
              <p className="font-medium text-slate-800 mt-0.5">{session.title}</p>
              {session.description && <p className="text-sm text-slate-500 mt-1">{session.description}</p>}
              <p className="text-xs text-slate-400 mt-1">
                {[session.speakerName, session.location && `Location: ${session.location}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {isAdmin && (
                <div className="flex gap-3 mt-2">
                  <button onClick={() => openEditForm(session)} className="text-xs font-medium text-indigo-600 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => setDeleteTarget(session)} className="text-xs font-medium text-red-600 hover:underline">
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-800 mb-4">
              {editingSession ? 'Edit Session' : 'Add Session'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <FormField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Start Time" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
                <FormField label="End Time" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Speaker</label>
                <select
                  value={form.speakerId}
                  onChange={(e) => setForm({ ...form, speakerId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">No speaker</option>
                  {speakers.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </div>
              <FormField label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60">
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete this session?"
        message={`"${deleteTarget?.title}" will be removed from the schedule.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export default ScheduleSection;
