function Spinner({ label = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <div className="h-6 w-6 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-sm mt-3">{label}</p>
    </div>
  );
}

export default Spinner;
