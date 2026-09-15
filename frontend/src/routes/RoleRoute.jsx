import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Wraps a set of routes that require a SPECIFIC role. Must be nested
 * inside <ProtectedRoute /> (or after it in the tree) so `user` is
 * guaranteed to exist by the time this runs. Usage:
 *
 *   <Route element={<ProtectedRoute />}>
 *     <Route element={<RoleRoute allowedRoles={['admin']} />}>
 *       <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
 *     </Route>
 *   </Route>
 *
 * This is a UX convenience only (redirects instead of showing a broken
 * page) — the real security boundary is the backend's `authorize()`
 * middleware, which rejects the API calls themselves regardless of what
 * the frontend renders.
 */
function RoleRoute({ allowedRoles }) {
  const { user } = useAuth();

  if (!allowedRoles.includes(user.role)) {
    const fallbackPath = user.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard';
    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
}

export default RoleRoute;
