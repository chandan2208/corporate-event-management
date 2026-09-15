/**
 * Simple prev/next pagination control driven entirely by the parent's
 * `pagination` object (as returned directly by the backend), so the
 * caller doesn't need to track page state redundantly.
 */
function Pagination({ pagination, onPageChange }) {
  const { page, totalPages, total } = pagination;

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between text-sm text-slate-500 mt-4">
      <span>
        Page {page} of {totalPages} &middot; {total} total
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40
            disabled:cursor-not-allowed hover:bg-slate-50"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40
            disabled:cursor-not-allowed hover:bg-slate-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default Pagination;
