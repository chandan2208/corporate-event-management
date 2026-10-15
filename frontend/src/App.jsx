import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleRoute from './routes/RoleRoute';

import RootRedirect from './pages/RootRedirect';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import EmployeeDashboardPage from './pages/EmployeeDashboardPage';
import HealthCheckPage from './pages/HealthCheckPage';
import NotFoundPage from './pages/NotFoundPage';

import AdminEventsListPage from './pages/admin/AdminEventsListPage';
import AdminEventFormPage from './pages/admin/AdminEventFormPage';
import AdminEventDetailPage from './pages/admin/AdminEventDetailPage';
import AdminCheckInPage from './pages/admin/AdminCheckInPage';
import EmployeeEventsListPage from './pages/employee/EmployeeEventsListPage';
import EmployeeEventDetailPage from './pages/employee/EmployeeEventDetailPage';
import MyRegistrationsPage from './pages/employee/MyRegistrationsPage';
import MyCertificatesPage from './pages/employee/MyCertificatesPage';
import AdminCertificatesPage from './pages/admin/AdminCertificatesPage';
import CertificateVerifyPage from './pages/CertificateVerifyPage';

/**
 * Route map as of Phase 3:
 *
 * "/"                              -> redirects based on auth state
 * "/login", "/register"            -> public
 * "/verify-email"                  -> public (Phase 15 email verification)
 * "/system/health"                 -> public diagnostics page from Phase 1
 *
 * Admin (requires login AND role=admin):
 *   "/admin/dashboard"
 *   "/admin/events"                -> list, filter, search, paginate
 *   "/admin/events/new"            -> create form
 *   "/admin/events/:id"            -> detail + status actions + delete
 *   "/admin/events/:id/edit"       -> edit form
 *
 * Employee (requires login AND role=employee):
 *   "/employee/dashboard"
 *   "/employee/events"             -> browse published events
 *   "/employee/events/:id"         -> event detail (registration comes in Phase 4)
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/system/health" element={<HealthCheckPage />} />
            <Route path="/verify/certificate/:verificationToken" element={<CertificateVerifyPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<RoleRoute allowedRoles={['admin']} />}>
                <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                <Route path="/admin/events" element={<AdminEventsListPage />} />
                <Route path="/admin/events/new" element={<AdminEventFormPage />} />
                <Route path="/admin/events/:id" element={<AdminEventDetailPage />} />
                <Route path="/admin/events/:id/edit" element={<AdminEventFormPage />} />
                <Route path="/admin/check-in" element={<AdminCheckInPage />} />
                <Route path="/admin/certificates" element={<AdminCertificatesPage />} />
              </Route>

              <Route element={<RoleRoute allowedRoles={['employee']} />}>
                <Route path="/employee/dashboard" element={<EmployeeDashboardPage />} />
                <Route path="/employee/events" element={<EmployeeEventsListPage />} />
                <Route path="/employee/events/:id" element={<EmployeeEventDetailPage />} />
                <Route path="/employee/my-registrations" element={<MyRegistrationsPage />} />
                <Route path="/employee/my-certificates" element={<MyCertificatesPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
