import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import TopBar from '../../components/TopBar';
import { checkInByToken } from '../../api/attendanceApi';

const SCANNER_ELEMENT_ID = 'qr-scanner-viewport';

const SCANNER_STATUS_LABELS = {
  idle: 'Stopped',
  starting: 'Requesting camera...',
  scanning: 'Scanning',
  paused: 'Paused (processing scan)',
};

/**
 * Maps a failed check-in response to a short, unambiguous message for the
 * person operating the scanner at the door. The backend's error message
 * is already human-readable (see registration.service.js's checkInByToken),
 * but we add a status-code fallback in case of network/server failures
 * that never reach that error-message layer at all.
 */
const describeError = (err) => {
  if (!err.response) {
    return 'Network error — could not reach the server. Check your connection and try again.';
  }
  const status = err.response.status;
  const message = err.response.data?.error?.message;

  if (status === 400) return message || 'Invalid QR code format.';
  if (status === 401) return 'Your session has expired — please log in again.';
  if (status === 403) return 'Only admins can perform check-ins.';
  if (status === 404) return 'Registration not found — this QR code does not match any registration.';
  if (status === 409) return message || 'This registration cannot be checked in right now.';
  return message || 'Something went wrong. Please try again.';
};

function AdminCheckInPage() {
  const scannerRef = useRef(null); // holds the Html5Qrcode instance
  const [scannerState, setScannerState] = useState('idle'); // 'idle' | 'starting' | 'scanning' | 'paused'
  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState(null); // { type: 'success'|'error', message, data? }
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Release the camera if the admin navigates away mid-scan.
    return () => {
      if (scannerRef.current && scannerState !== 'idle') {
        scannerRef.current.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScanSuccess = async (decodedText) => {
    // Immediately pause — before the network call even starts — so the
    // same badge sitting in front of the camera can't trigger a second
    // scan while we're still processing the first one.
    if (scannerRef.current) {
      try {
        scannerRef.current.pause(true);
      } catch {
        /* already paused/stopped — ignore */
      }
    }
    setScannerState('paused');
    setChecking(true);
    setResult(null);

    try {
      const registration = await checkInByToken(decodedText);
      setResult({ type: 'success', data: registration });
    } catch (err) {
      setResult({ type: 'error', message: describeError(err) });
    } finally {
      setChecking(false);
    }
  };

  const handleStart = async () => {
    setCameraError('');
    setResult(null);
    setScannerState('starting');

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(SCANNER_ELEMENT_ID);
      }
      await scannerRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleScanSuccess,
        () => {
          // Called continuously while no QR is in frame — not an error,
          // just "nothing detected on this frame yet".
        }
      );
      setScannerState('scanning');
    } catch (err) {
      setCameraError(
        'Could not access the camera. Please grant camera permission and try again.'
      );
      setScannerState('idle');
    }
  };

  const handleStop = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        /* ignore */
      }
    }
    setScannerState('idle');
    setResult(null);
  };

  const handleScanNext = () => {
    setResult(null);
    if (scannerRef.current) {
      scannerRef.current.resume();
    }
    setScannerState('scanning');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar />
      <main className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-lg font-semibold text-slate-800 mb-1">Event Check-in</h1>
        <p className="text-sm text-slate-500 mb-6">
          Scan an employee&apos;s QR code to mark them as checked in.
        </p>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          {/* The scanner library renders the camera feed into this div by id */}
          <div
            id={SCANNER_ELEMENT_ID}
            className={scannerState === 'idle' ? 'hidden' : 'rounded-xl overflow-hidden'}
          />

          {scannerState === 'idle' && !cameraError && (
            <div className="text-center py-12 text-slate-400 text-sm">
              Scanner is stopped. Click &quot;Start Scanner&quot; to begin.
            </div>
          )}

          {cameraError && (
            <div className="text-center py-6">
              <p className="text-sm text-red-600">{cameraError}</p>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            {scannerState === 'idle' ? (
              <button
                onClick={handleStart}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm
                  font-medium py-2.5 rounded-lg"
              >
                Start Scanner
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700
                  text-sm font-medium py-2.5 rounded-lg"
              >
                Stop Scanner
              </button>
            )}
          </div>

          <p className="text-xs text-slate-400 mt-3 text-center">
            Status: {SCANNER_STATUS_LABELS[scannerState]}
          </p>
        </div>

        {checking && (
          <div className="mt-4 bg-white rounded-2xl shadow-sm p-6 text-center text-sm text-slate-500">
            Checking in...
          </div>
        )}

        {result?.type === 'success' && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-2xl p-6">
            <p className="font-semibold text-green-800">✓ Check-in Successful</p>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Employee</dt>
                <dd className="font-medium text-slate-800">{result.data.employeeName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Event</dt>
                <dd className="font-medium text-slate-800">{result.data.event.title}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Seat</dt>
                <dd className="font-medium text-slate-800">{result.data.seatLabel}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Checked in at</dt>
                <dd className="font-medium text-slate-800">
                  {new Date(result.data.checkedInAt).toLocaleTimeString()}
                </dd>
              </div>
            </dl>
            <button
              onClick={handleScanNext}
              className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm
                font-medium py-2.5 rounded-lg"
            >
              Scan Next
            </button>
          </div>
        )}

        {result?.type === 'error' && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-6">
            <p className="font-semibold text-red-800">✗ Check-in Failed</p>
            <p className="text-sm text-red-700 mt-1">{result.message}</p>
            <button
              onClick={handleScanNext}
              className="mt-4 w-full border border-red-300 text-red-700 hover:bg-red-100
                text-sm font-medium py-2.5 rounded-lg"
            >
              Scan Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminCheckInPage;
