import { useEffect, useState } from 'react';
import { getMyCertificateForRegistration, downloadCertificate } from '../api/certificatesApi';
import { useToast } from '../context/ToastContext';

/**
 * Shown on the employee's event detail page. Only ever attempts to
 * fetch/create a certificate when `registrationStatus` is already
 * CHECKED_IN or COMPLETED — for REGISTERED/CANCELLED/no-registration it
 * shows an explanatory message instead, so we never falsely suggest a
 * certificate is available before it actually is. The backend
 * independently re-derives eligibility on every request regardless.
 */
function CertificateAvailability({ registrationId, registrationStatus }) {
  const { showToast } = useToast();
  const [certificate, setCertificate] = useState(null);
  const [loadState, setLoadState] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
  const [downloading, setDownloading] = useState(false);

  const isEligible = ['CHECKED_IN', 'COMPLETED'].includes(registrationStatus);

  useEffect(() => {
    if (!isEligible || !registrationId) return;
    setLoadState('loading');
    getMyCertificateForRegistration(registrationId)
      .then((data) => {
        setCertificate(data);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, [isEligible, registrationId]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await downloadCertificate(certificate.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certificate.certificateNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to download certificate', 'error');
    } finally {
      setDownloading(false);
    }
  };

  if (!isEligible) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 mb-2">Certificate</h2>
        <p className="text-sm text-slate-500">
          Your certificate becomes available after you've been checked in at the event.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="font-semibold text-slate-800 mb-2">Certificate</h2>

      {loadState === 'loading' && <p className="text-sm text-slate-400">Loading...</p>}
      {loadState === 'error' && <p className="text-sm text-red-600">Could not load certificate.</p>}

      {loadState === 'ready' && certificate && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-medium text-green-800">Certificate Available</p>
          <p className="text-xs text-green-700 mt-1">No: {certificate.certificateNumber}</p>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="mt-3 text-sm font-medium text-indigo-600 hover:underline disabled:opacity-50"
          >
            {downloading ? 'Downloading...' : 'Download PDF'}
          </button>
        </div>
      )}
    </div>
  );
}

export default CertificateAvailability;
