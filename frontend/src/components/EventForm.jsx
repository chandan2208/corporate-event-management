import { useState } from 'react';
import FormField from './FormField';
import AlertBanner from './AlertBanner';

const emptyForm = {
  title: '',
  description: '',
  venue: '',
  eventDate: '',
  startTime: '',
  endTime: '',
  capacity: '',
  registrationDeadline: '',
};

/**
 * Converts an event object as returned by the API (ISO date strings,
 * "HH:MM:SS" times) into the plain string values HTML date/time inputs
 * expect ("YYYY-MM-DD", "HH:MM", "YYYY-MM-DDTHH:MM").
 */
export const eventToFormValues = (event) => {
  if (!event) return emptyForm;
  return {
    title: event.title || '',
    description: event.description || '',
    venue: event.venue || '',
    eventDate: event.eventDate ? String(event.eventDate).slice(0, 10) : '',
    startTime: event.startTime ? String(event.startTime).slice(0, 5) : '',
    endTime: event.endTime ? String(event.endTime).slice(0, 5) : '',
    capacity: event.capacity ?? '',
    registrationDeadline: event.registrationDeadline
      ? String(event.registrationDeadline).slice(0, 16)
      : '',
  };
};

/**
 * Shared form for both "create event" and "edit event". The parent
 * decides what happens on submit (POST vs PUT) — this component only
 * cares about collecting and lightly shaping the field values.
 */
function EventForm({ initialValues = emptyForm, onSubmit, submitting, submitLabel, formError, fieldErrors = {} }) {
  const [form, setForm] = useState(initialValues);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      capacity: form.capacity === '' ? '' : Number(form.capacity),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <AlertBanner message={formError} />

      <FormField
        label="Event Title"
        name="title"
        value={form.title}
        onChange={handleChange}
        error={fieldErrors.title}
        required
      />

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
        <textarea
          name="description"
          rows={4}
          value={form.description}
          onChange={handleChange}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        {fieldErrors.description && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
        )}
      </div>

      <FormField
        label="Venue"
        name="venue"
        value={form.venue}
        onChange={handleChange}
        error={fieldErrors.venue}
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Event Date"
          type="date"
          name="eventDate"
          value={form.eventDate}
          onChange={handleChange}
          error={fieldErrors.eventDate}
          required
        />
        <FormField
          label="Capacity"
          type="number"
          min="1"
          name="capacity"
          value={form.capacity}
          onChange={handleChange}
          error={fieldErrors.capacity}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Start Time"
          type="time"
          name="startTime"
          value={form.startTime}
          onChange={handleChange}
          error={fieldErrors.startTime}
          required
        />
        <FormField
          label="End Time"
          type="time"
          name="endTime"
          value={form.endTime}
          onChange={handleChange}
          error={fieldErrors.endTime}
          required
        />
      </div>

      <FormField
        label="Registration Deadline"
        type="datetime-local"
        name="registrationDeadline"
        value={form.registrationDeadline}
        onChange={handleChange}
        error={fieldErrors.registrationDeadline}
        required
      />

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60
          disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg
          transition-colors"
      >
        {submitting ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}

export default EventForm;
