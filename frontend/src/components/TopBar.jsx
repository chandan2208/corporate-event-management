import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navLinkClass = ({ isActive }) =>
  `text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`;

/**
 * Top bar shown on dashboard pages — shows who's logged in, their role, a
 * logout button, and role-appropriate navigation. More links (Registrations,
 * QR Scanner, Speakers, etc.) get added here in later phases.
 */
function TopBar() {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-slate-800">Corporate Event Management</span>
          <nav className="flex items-center gap-4">
            {user?.role === 'admin' ? (
              <>
                <NavLink to="/admin/dashboard" className={navLinkClass}>
                  Dashboard
                </NavLink>
                <NavLink to="/admin/events" className={navLinkClass}>
                  Events
                </NavLink>
                <NavLink to="/admin/check-in" className={navLinkClass}>
                  Check-in
                </NavLink>
                <NavLink to="/admin/certificates" className={navLinkClass}>
                  Certificates
                </NavLink>
              </>
            ) : (
              <>
                <NavLink to="/employee/dashboard" className={navLinkClass}>
                  Dashboard
                </NavLink>
                <NavLink to="/employee/events" className={navLinkClass}>
                  Events
                </NavLink>
                <NavLink to="/employee/my-registrations" className={navLinkClass}>
                  My Registrations
                </NavLink>
                <NavLink to="/employee/my-certificates" className={navLinkClass}>
                  My Certificates
                </NavLink>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">
            {user?.name}{' '}
            <span className="ml-1 inline-block rounded-full bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 capitalize">
              {user?.role}
            </span>
          </span>
          <button
            onClick={logout}
            className="text-sm text-slate-500 hover:text-red-600 font-medium"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
