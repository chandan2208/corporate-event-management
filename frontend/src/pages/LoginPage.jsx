import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FormField from '../components/FormField';
import AlertBanner from '../components/AlertBanner';
import { resendVerificationRequest } from '../api/authApi';

/**
 * ONE login page/form for both roles. The backend decides whether the
 * account is admin or employee based on what's in the database — there is
 * no "login as admin" toggle on this form, since that would just be a
 * client-side hint that means nothing for security.
 */
function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const justVerified = location.state?.verified === true;

  const [form, setForm] = useState({ email: location.state?.email || '', password: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Phase 15: set when the backend says this account's email isn't verified.
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resending, setResending] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setUnverifiedEmail('');
    setSubmitting(true);

    try {
      const user = await login(form);
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard', {
        replace: true,
      });
    } catch (err) {
      if (err.response?.data?.error?.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(form.email.trim().toLowerCase());
      } else {
        setFormError(
          err.response?.data?.error?.message || 'Something went wrong. Please try again.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const goToVerify = (extraState = {}) =>
    navigate('/verify-email', { state: { email: unverifiedEmail, ...extraState } });

  const handleResend = async () => {
    setResending(true);
    setFormError('');
    try {
      await resendVerificationRequest({ email: unverifiedEmail });
      goToVerify({ from: 'login-resend', resendCooldownSeconds: 60 });
    } catch (err) {
      const retryAfter = parseInt(
        err.response?.data?.error?.retryAfterSeconds ?? err.response?.headers?.['retry-after'],
        10
      );
      if (err.response?.status === 429 && Number.isFinite(retryAfter)) {
        // A code was sent very recently — go enter it, with the countdown running.
        goToVerify({ resendCooldownSeconds: retryAfter });
        return;
      }
      setFormError(err.response?.data?.error?.message || 'Could not send a new code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-800">Corporate Event Management</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to your account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-md p-6 space-y-4"
          noValidate
        >
          {justVerified && !unverifiedEmail && !formError && (
            <AlertBanner type="success" message="Email verified. You can now sign in." />
          )}
          <AlertBanner message={formError} />

          {unverifiedEmail && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3" role="alert">
              <p className="text-sm font-medium text-amber-800">Your email is not verified.</p>
              <p className="text-xs text-amber-700 mt-1">
                Enter the 6-digit code we emailed you, or request a new one.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => goToVerify()}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium py-2 rounded-lg transition-colors"
                >
                  Verify Email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="flex-1 border border-amber-300 bg-white hover:bg-amber-100 text-amber-800 text-xs
                    font-medium py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {resending ? 'Sending...' : 'Resend Code'}
                </button>
              </div>
            </div>
          )}

          <FormField
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            required
          />

          <FormField
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            required
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60
              disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg
              transition-colors"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-indigo-600 font-medium hover:underline">
            Register as an employee
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
