import { useEffect, useState } from 'react';
import { listSpeakers, createSpeaker, updateSpeaker, deleteSpeaker } from '../api/speakersApi';
import Spinner from './Spinner';
import EmptyState from './EmptyState';
import ConfirmModal from './ConfirmModal';
import FormField from './FormField';
import { useToast } from '../context/ToastContext';

const emptySpeakerForm = { name: '', designation: '', company: '', bio: '', photoUrl: '' };

/**
 * Shown on both the admin and employee event detail pages. `isAdmin`
 * controls whether add/edit/delete controls render — but that's only a
 * UX convenience; the backend independently enforces the same rule via
 * `authorize('admin')` on the mutation endpoints, so an employee could
 * never actually perform these actions even by calling the API directly.
 */
function SpeakersSection({ eventId, isAdmin }) {
  const { showToast } = useToast();
  const [speakers, setSpeakers] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState(null); // null = creating new
  const [form, setForm] = useState(emptySpeakerForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchSpeakers = () => {
    setLoadState('loading');
    listSpeakers(eventId)
      .then((data) => {
        setSpeakers(data);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  };

  useEffect(() => {
    fetchSpeakers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const openCreateForm = () => {
    setEditingSpeaker(null);
    setForm(emptySpeakerForm);
    setFormError('');
    setFormOpen(true);
  };

  const openEditForm = (speaker) => {
    setEditingSpeaker(speaker);
    setForm({
      name: speaker.name || '',
      designation: speaker.designation || '',
      company: speaker.company || '',
      bio: speaker.bio || '',
      photoUrl: speaker.photoUrl || '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      if (editingSpeaker) {
        await updateSpeaker(editingSpeaker.id, form);
        showToast('Speaker updated');
      } else {
        await createSpeaker(eventId, form);
        showToast('Speaker added');
      }
      setFormOpen(false);
      fetchSpeakers();
    } catch (err) {
      setFormError(err.response?.data?.error?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteSpeaker(deleteTarget.id);
      showToast('Speaker deleted');
      fetchSpeakers();
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to delete speaker', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-800">Speakers</h2>
        {isAdmin && (
          <button
            onClick={openCreateForm}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            + Add Speaker
          </button>
        )}
      </div>

      {loadState === 'loading' && <Spinner label="Loading speakers..." />}
      {loadState === 'error' && (
        <p className="text-sm text-red-600">Could not load speakers.</p>
      )}
      {loadState === 'ready' && speakers.length === 0 && (
        <EmptyState title="No speakers added yet" />
      )}

      {loadState === 'ready' && speakers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {speakers.map((speaker) => (
            <div key={speaker.id} className="border border-slate-100 rounded-xl p-4">
              <div className="flex items-start gap-3">
                {speaker.photoUrl && (
                  <img
                    src={speaker.photoUrl}
                    alt={speaker.name}
                    className="w-12 h-12 rounded-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{speaker.name}</p>
                  <p className="text-xs text-slate-500">
                    {[speaker.designation, speaker.company].filter(Boolean).join(' at ')}
                  </p>
                  {speaker.bio && <p className="text-xs text-slate-500 mt-2">{speaker.bio}</p>}
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-3 mt-3 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => openEditForm(speaker)}
                    className="text-xs font-medium text-indigo-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(speaker)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-semibold text-slate-800 mb-4">
              {editingSpeaker ? 'Edit Speaker' : 'Add Speaker'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <FormField
                label="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <FormField
                label="Designation"
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
              />
              <FormField
                label="Company"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
              <FormField
                label="Photo URL"
                value={form.photoUrl}
                onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bio</label>
                <textarea
                  rows={3}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700
                    rounded-lg disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete this speaker?"
        message={`"${deleteTarget?.name}" will be removed. Any schedule sessions referencing them will keep their other details but no longer show a speaker.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export default SpeakersSection;
