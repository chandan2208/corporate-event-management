import { useEffect, useState } from 'react';
import { getRegistrationQr } from '../api/registrationsApi';
import Spinner from './Spinner';

/**
 * Fetches and displays the QR code for a given registration id.
 * Handles its own loading/error state so it can be dropped into any page
 * that has a registration id (event detail, my-registrations) without
 * duplicating the fetch logic.
 */
function QrCodeCard({ registrationId }) {
  const [qrCode, setQrCode] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoadState('loading');
    getRegistrationQr(registrationId)
      .then((data) => {
        if (!isMounted) return;
        setQrCode(data);
        setLoadState('ready');
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMessage(
          err.response?.data?.error?.message || 'Could not load QR code.'
        );
        setLoadState('error');
      });
    return () => {
      isMounted = false;
    };
  }, [registrationId]);

  if (loadState === 'loading') {
    return <Spinner label="Loading QR code..." />;
  }

  if (loadState === 'error') {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-slate-500">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <img
        src={qrCode.dataUrl}
        alt="Event check-in QR code"
        className="w-48 h-48 rounded-xl border border-slate-200"
      />
      <a
        href={qrCode.dataUrl}
        download={`event-checkin-qr-${registrationId}.png`}
        className="mt-3 text-sm font-medium text-indigo-600 hover:underline"
      >
        Download QR Code
      </a>
      <p className="text-xs text-slate-400 mt-2 text-center max-w-xs">
        Show this at the event check-in desk. It does not contain any
        personal information — only a secure registration reference.
      </p>
    </div>
  );
}

export default QrCodeCard;
