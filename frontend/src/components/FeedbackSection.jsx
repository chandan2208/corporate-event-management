import { useEffect, useState } from 'react';
import { submitFeedback, getMyFeedback } from '../api/feedbackApi';
import Spinner from './Spinner';
import { useToast } from '../context/ToastContext';

/**
 * Shown on the employee's event detail page. Three states:
 *   - already submitted: show what they left, no active form
 *   - eligible (checked in / completed, hasn't submitted yet): show form
 *   - not eligible: explain why, no misleading active form
 *
 * The eligibility check here is a UX convenience only — the backend
 * independently re-derives eligibility from the employee's actual
 * registration status on every submit attempt (see feedback.service.js),
 * so this component can never be used to bypass anything.
 */
function StarSelector({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-2xl leading-none ${star <= value ? 'text-yellow-400' : 'text-slate-300'}`}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function FeedbackSection({ eventId, registrationStatus }) {
  const { showToast } = useToast();
  const [myFeedback, setMyFeedback] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready'
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    getMyFeedback(eventId)
      .then((data) => {
        setMyFeedback(data);
        setLoadState('ready');
      })
      .catch(() => {
        // 404 just means "hasn't submitted yet" — not an error state.
        setMyFeedback(null);
        setLoadState('ready');
      });
  }, [eventId]);

  const isEligible = ['CHECKED_IN', 'COMPLETED'].includes(registrationStatus);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      setFormError('Please select a star rating.');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      const feedback = await submitFeedback(eventId, { rating, comment: comment || undefined });
      setMyFeedback(feedback);
      showToast('Thanks for your feedback!');
    } catch (err) {
      setFormError(err.response?.data?.error?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadState === 'loading') {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <Spinner label="Loading feedback..." />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="font-semibold text-slate-800 mb-4">Feedback</h2>

      {myFeedback ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-medium text-green-800">You submitted your feedback</p>
          <div className="mt-2 text-yellow-400 text-lg">
            {'★'.repeat(myFeedback.rating)}
            <span className="text-slate-200">{'★'.repeat(5 - myFeedback.rating)}</span>
          </div>
          {myFeedback.comment && (
            <p className="text-sm text-slate-600 mt-2">{myFeedback.comment}</p>
          )}
        </div>
      ) : isEligible ? (
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Your rating</label>
            <StarSelector value={rating} onChange={setRating} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Comment (optional)
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="What did you think of the event?"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white
              hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-slate-500">
          Feedback becomes available after you've been checked in at the event.
        </p>
      )}
    </div>
  );
}

export default FeedbackSection;
