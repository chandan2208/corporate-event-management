import { useEffect, useState } from 'react';
import { listEventFeedback, getFeedbackSummary } from '../api/feedbackApi';
import Spinner from './Spinner';
import EmptyState from './EmptyState';

function AdminFeedbackSection({ eventId }) {
  const [summary, setSummary] = useState(null);
  const [feedbackList, setFeedbackList] = useState([]);
  const [loadState, setLoadState] = useState('loading');

  useEffect(() => {
    setLoadState('loading');
    Promise.all([getFeedbackSummary(eventId), listEventFeedback(eventId)])
      .then(([summaryData, listData]) => {
        setSummary(summaryData);
        setFeedbackList(listData);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, [eventId]);

  if (loadState === 'loading') {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <Spinner label="Loading feedback..." />
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <p className="text-sm text-red-600">Could not load feedback.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="font-semibold text-slate-800 mb-4">Feedback</h2>

      {summary.totalResponses === 0 ? (
        <EmptyState title="No feedback yet" description="Responses will appear here after employees check in and submit." />
      ) : (
        <>
          <div className="flex items-center gap-6 mb-4">
            <div>
              <p className="text-3xl font-bold text-slate-800">{summary.averageRating}</p>
              <p className="text-xs text-slate-400">out of 5</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-700">{summary.totalResponses}</p>
              <p className="text-xs text-slate-400">total responses</p>
            </div>
          </div>

          <div className="space-y-1 mb-6">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = summary.distribution[star] || 0;
              const pct = summary.totalResponses > 0 ? (count / summary.totalResponses) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="w-8">{star}★</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            {feedbackList.map((fb) => (
              <div key={fb.id} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{fb.employeeName}</span>
                  <span className="text-yellow-400">
                    {'★'.repeat(fb.rating)}
                    <span className="text-slate-200">{'★'.repeat(5 - fb.rating)}</span>
                  </span>
                </div>
                {fb.comment && <p className="text-slate-500 mt-1">{fb.comment}</p>}
                <p className="text-xs text-slate-300 mt-1">
                  {new Date(fb.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default AdminFeedbackSection;
