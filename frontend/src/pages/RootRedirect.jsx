import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * The root path ("/") isn't a real page — it just decides where to send
 * the visitor: their dashboard if already logged in, or the login page
 * if not.
 */
function RootRedirect() {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard'} replace />
  );
}

export default RootRedirect;
