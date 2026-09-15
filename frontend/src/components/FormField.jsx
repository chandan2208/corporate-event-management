/**
 * Reusable labeled text input for auth forms. Keeps LoginPage/RegisterPage
 * markup clean and ensures consistent styling across all form fields.
 */
function FormField({ label, error, ...inputProps }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
          ${error ? 'border-red-400' : 'border-slate-300'}`}
        {...inputProps}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default FormField;
