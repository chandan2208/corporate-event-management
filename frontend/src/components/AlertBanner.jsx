/**
 * Simple inline banner used for form-level errors (e.g. "Invalid email or
 * password") that don't belong to one specific field.
 */
function AlertBanner({ type = 'error', message }) {
  if (!message) return null;

  const STYLES = {
    error: 'bg-red-50 text-red-700 border-red-200',
    success: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };
  const styles = STYLES[type] || STYLES.success;

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${styles}`} role="alert">
      {message}
    </div>
  );
}

export default AlertBanner;
