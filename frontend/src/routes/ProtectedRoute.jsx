import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Wraps a set of routes that require ANY logged-in user (regardless of
 * role). Usage in App.jsx:
 *
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/some-page" element={<SomePage />} />
 *   </Route>
 */
function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

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

  return <Outlet />;
}

export default ProtectedRoute;
