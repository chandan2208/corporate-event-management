const STATUS_STYLES = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PUBLISHED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-indigo-100 text-indigo-700',
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-block rounded-full text-xs font-medium px-2.5 py-1 ${style}`}>
      {status}
    </span>
  );
}

export default StatusBadge;
