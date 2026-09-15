/**
 * Simple inline banner used for form-level errors (e.g. "Invalid email or
 * password") that don't belong to one specific field.
 */
function AlertBanner({ type = 'error', message }) {
  if (!message) return null;

  const styles =
    type === 'error'
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-green-50 text-green-700 border-green-200';

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${styles}`} role="alert">
      {message}
    </div>
  );
}

export default AlertBanner;
