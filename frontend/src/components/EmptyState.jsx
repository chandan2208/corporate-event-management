/**
 * Shown whenever a list request succeeds but returns zero items — this is
 * a normal, expected state (e.g. no published events yet), not an error,
 * so it gets its own calm visual treatment rather than looking broken.
 */
function EmptyState({ title, description, action }) {
  return (
    <div className="text-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-2xl">
      <h3 className="text-slate-700 font-medium">{title}</h3>
      {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;
