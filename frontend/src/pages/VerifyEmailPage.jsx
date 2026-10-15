import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField';
import AlertBanner from '../components/AlertBanner';
import VerificationCodeInput from '../components/VerificationCodeInput';
import { verifyEmailRequest, resendVerificationRequest } from '../api/authApi';
import { maskEmail } from '../utils/maskEmail';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_COOLDOWN_SECONDS = 60;

/**
 * Phase 15 — "Verify your email".
 *
 * Reached from registration, or from the login page when an unverified
 * account tries to sign in. The full address arrives in in-memory router
 * state (never in the URL); if the page is opened directly, the user types
 * it. The backend decides everything — this page never knows the code and
 * never treats anything as verified until the API says so.
 */
function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const navState = location.state || {};

  const [email, setEmail] = useState(navState.email || '');
  const [editingEmail, setEditingEmail] = useState(!navState.email);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [notice, setNotice] = useState(() => {
    if (navState.from === 'register' && navState.emailSent === false) {
      return {
        type: 'warning',
        text: "Your account was created, but we couldn't send the verification email just now. Use “Resend code” below.",
      };
    }
    if (navState.from === 'login-resend') {
      return { type: 'info', text: 'If the account requires verification, a new code has been sent.' };
    }
    return null;
  });
  const [cooldown, setCooldown] = useState(
    Number.isFinite(navState.resendCooldownSeconds) ? navState.resendCooldownSeconds : 0
  );
  const [verified, setVerified] = useState(false);

  // Resend countdown.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = EMAIL_PATTERN.test(normalizedEmail);
  const displayEmail = navState.maskedEmail && !editingEmail && navState.email === email
    ? navState.maskedEmail
    : maskEmail(normalizedEmail);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setCodeError(false);

    if (!emailValid) {
      setError('Please enter the email address you registered with.');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setCodeError(true);
      setError('Enter the 6-digit code from your email.');
      return;
    }

    setVerifying(true);
    try {
      await verifyEmailRequest({ email: normalizedEmail, code });
      setVerified(true);
    } catch (err) {
      const apiError = err.response?.data?.error;
      switch (apiError?.code) {
        case 'ALREADY_VERIFIED':
          setVerified(true);
          break;
        case 'TOO_MANY_ATTEMPTS':
        case 'CODE_EXPIRED':
          setCode('');
          setCodeError(true);
          setError(apiError.message);
          break;
        case 'INVALID_CODE':
          setCode('');
          setCodeError(true);
          setError('That code is incorrect or has expired. Check the latest email and try again.');
          break;
        default:
          setError(apiError?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setNotice(null);

    if (!emailValid) {
      setError('Please enter the email address you registered with.');
      return;
    }

    setResending(true);
    try {
      const res = await resendVerificationRequest({ email: normalizedEmail });
      setNotice({ type: 'info', text: res.message });
      setCode('');
      setCodeError(false);
      setCooldown(DEFAULT_COOLDOWN_SECONDS);
    } catch (err) {
      const retryAfter = parseInt(
        err.response?.data?.error?.retryAfterSeconds ?? err.response?.headers?.['retry-after'],
        10
      );
      if (err.response?.status === 429 && Number.isFinite(retryAfter)) {
        setCooldown(retryAfter);
      }
      setError(err.response?.data?.error?.message || 'Could not request a new code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  if (verified) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full">
          <div className="bg-white rounded-2xl shadow-md p-6 text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-slate-800">Email verified</h1>
            <p className="text-sm text-slate-500 mt-2">
              Your account is ready. Sign in with your email and password to continue.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true, state: { email: normalizedEmail, verified: true } })}
              className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              Continue to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="max-w-sm w-full">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-800">Verify your email</h1>
          {!editingEmail && emailValid ? (
            <p className="text-sm text-slate-500 mt-1">
              We sent a 6-digit verification code to
              <br />
              <span className="font-medium text-slate-700">{displayEmail}</span>
            </p>
          ) : (
            <p className="text-sm text-slate-500 mt-1">
              Enter your email and the 6-digit code we sent you.
            </p>
          )}
        </div>

        <form onSubmit={handleVerify} className="bg-white rounded-2xl shadow-md p-6 space-y-5" noValidate>
          {notice && <AlertBanner type={notice.type} message={notice.text} />}
          <AlertBanner message={error} />

          {editingEmail ? (
            <FormField
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          ) : (
            <div className="text-right -mt-2">
              <button
                type="button"
                onClick={() => setEditingEmail(true)}
                className="text-xs text-indigo-600 hover:underline"
              >
                Use a different email
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Verification code</label>
            <VerificationCodeInput
              value={code}
              onChange={(next) => {
                setCode(next);
                if (codeError) setCodeError(false);
              }}
              disabled={verifying}
              hasError={codeError}
              autoFocus={!editingEmail}
            />
            <p className="text-xs text-slate-400 mt-2">The code expires 10 minutes after it was sent.</p>
          </div>

          <button
            type="submit"
            disabled={verifying || code.length !== 6}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60
              disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg
              transition-colors"
          >
            {verifying ? 'Verifying...' : 'Verify Email'}
          </button>

          <div className="border-t border-slate-100 pt-4 text-center">
            <p className="text-sm text-slate-500">Didn&apos;t receive the code?</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="mt-2 text-sm font-medium text-indigo-600 hover:underline disabled:text-slate-400
                disabled:no-underline disabled:cursor-not-allowed"
            >
              {resending ? 'Sending...' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
            <p className="text-xs text-slate-400 mt-1">Check your spam folder too.</p>
          </div>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          Already verified?{' '}
          <Link to="/login" className="text-indigo-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
