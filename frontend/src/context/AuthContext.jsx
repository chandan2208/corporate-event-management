import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { loginRequest, registerRequest, logoutRequest, refreshRequest } from '../api/authApi';
import { setAccessToken, clearAccessToken } from '../api/tokenStore';

const AuthContext = createContext(null);

/**
 * Wraps the whole app. Responsible for:
 * - Holding the current user + auth status
 * - Restoring a session on page load (via the httpOnly refresh cookie)
 * - Exposing login/register/logout actions to any component
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true until initial session check finishes

  // On first mount, try to silently restore a session. If the user has a
  // valid refresh-token cookie from a previous visit, this logs them back
  // in without showing the login page.
  useEffect(() => {
    let isMounted = true;

    refreshRequest()
      .then(({ user: restoredUser, accessToken }) => {
        if (!isMounted) return;
        setAccessToken(accessToken);
        setUser(restoredUser);
      })
      .catch(() => {
        // No valid session — this is the normal case for a first-time
        // visitor, not an error to show the user.
        clearAccessToken();
        setUser(null);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const { user: loggedInUser, accessToken } = await loginRequest(credentials);
    setAccessToken(accessToken);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  // Phase 15: registering creates an UNVERIFIED account and emails a code.
  // It does not sign the user in — no token is returned or stored here.
  const register = useCallback(async (payload) => registerRequest(payload), []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      clearAccessToken();
      setUser(null);
    }
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
