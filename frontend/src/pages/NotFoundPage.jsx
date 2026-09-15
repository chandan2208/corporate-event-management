import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <h1 className="text-3xl font-bold text-slate-800">404</h1>
      <p className="text-slate-500 mt-2">Page not found</p>
      <Link to="/" className="text-indigo-600 font-medium hover:underline mt-4 text-sm">
        Go back home
      </Link>
    </div>
  );
}

export default NotFoundPage;
