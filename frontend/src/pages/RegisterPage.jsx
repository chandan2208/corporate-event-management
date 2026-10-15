import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FormField from '../components/FormField';
import AlertBanner from '../components/AlertBanner';

const INITIAL_FORM = {
  name: '',
  email: '',
  password: '',
  department: '',
  designation: '',
};

/**
 * Public self-registration — always creates an EMPLOYEE account. There is
 * no role selector here on purpose: admin accounts are created only via
 * the backend's `npm run seed:admin` script (see backend README), never
 * through this form.
 */
function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});
    setSubmitting(true);

    try {
      // Phase 15: account is created unverified; continue to the code page.
      // The full email travels only in in-memory router state (never the URL).
      const { data } = await register(form);
      navigate('/verify-email', {
        replace: true,
        state: {
          email: form.email.trim().toLowerCase(),
          maskedEmail: data?.email,
          emailSent: data?.emailSent,
          resendCooldownSeconds: data?.resendCooldownSeconds,
          from: 'register',
        },
      });
    } catch (err) {
      const apiError = err.response?.data?.error;

      if (apiError?.details?.length) {
        const mapped = {};
        apiError.details.forEach((d) => {
          mapped[d.field] = d.message;
        });
        setFieldErrors(mapped);
      } else {
        setFormError(apiError?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="max-w-sm w-full">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-800">Employee Registration</h1>
          <p className="text-sm text-slate-500 mt-1">Create your account to register for events</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-md p-6 space-y-4"
          noValidate
        >
          <AlertBanner message={formError} />

          <FormField
            label="Full Name"
            type="text"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={handleChange}
            error={fieldErrors.name}
            required
          />

          <FormField
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            error={fieldErrors.email}
            required
          />

          <FormField
            label="Password"
            type="password"
            name="password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            error={fieldErrors.password}
            required
          />
          <p className="text-xs text-slate-400 -mt-2">
            At least 8 characters, with at least one letter and one number.
          </p>

          <FormField
            label="Department (optional)"
            type="text"
            name="department"
            value={form.department}
            onChange={handleChange}
            error={fieldErrors.department}
          />

          <FormField
            label="Designation (optional)"
            type="text"
            name="designation"
            value={form.designation}
            onChange={handleChange}
            error={fieldErrors.designation}
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60
              disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg
              transition-colors"
          >
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
