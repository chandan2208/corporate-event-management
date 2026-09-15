import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';
import EventForm, { eventToFormValues } from '../../components/EventForm';
import { getEvent, createEvent, updateEvent } from '../../api/eventsApi';
import { useToast } from '../../context/ToastContext';

function AdminEventFormPage() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [initialValues, setInitialValues] = useState(undefined);
  const [loadState, setLoadState] = useState(isEditMode ? 'loading' : 'ready');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!isEditMode) return;
    getEvent(id)
      .then((event) => {
        setInitialValues(eventToFormValues(event));
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, [id, isEditMode]);

  const handleSubmit = async (values) => {
    setFormError('');
    setFieldErrors({});
    setSubmitting(true);

    try {
      if (isEditMode) {
        await updateEvent(id, values);
        showToast('Event updated successfully');
        navigate(`/admin/events/${id}`);
      } else {
        const event = await createEvent(values);
        showToast('Event created successfully');
        navigate(`/admin/events/${event.id}`);
      }
    } catch (err) {
      const apiError = err.response?.data?.error;
      if (apiError?.details?.length) {
        const mapped = {};
        apiError.details.forEach((d) => {
          mapped[d.field] = d.message;
        });
        setFieldErrors(mapped);
      } else {
        setFormError(apiError?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-lg font-semibold text-slate-800 mb-6">
          {isEditMode ? 'Edit Event' : 'Create Event'}
        </h1>

        {loadState === 'loading' && <Spinner label="Loading event..." />}

        {loadState === 'error' && (
          <p className="text-sm text-red-600">
            Could not load this event. It may not exist or may not be editable.
          </p>
        )}

        {loadState === 'ready' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <EventForm
              initialValues={initialValues}
              onSubmit={handleSubmit}
              submitting={submitting}
              submitLabel={isEditMode ? 'Save Changes' : 'Create Event'}
              formError={formError}
              fieldErrors={fieldErrors}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminEventFormPage;
