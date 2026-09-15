import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { verifyCertificate } from '../api/certificatesApi';

function CertificateVerifyPage() {
  const { verificationToken } = useParams();
  const [result, setResult] = useState(null);
  const [loadState, setLoadState] = useState('loading');

  useEffect(() => {
    verifyCertificate(verificationToken)
      .then((data) => {
        setResult(data);
        setLoadState('ready');
      })
      .catch(() => setLoadState('not_found'));
  }, [verificationToken]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-800">Certificate Verification</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-8">
          {loadState === 'loading' && (
            <p className="text-center text-sm text-slate-400">Checking certificate...</p>
          )}

          {loadState === 'not_found' && (
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-2xl mb-3">
                ?
              </div>
              <p className="font-semibold text-slate-700">Certificate Not Found</p>
              <p className="text-sm text-slate-500 mt-1">
                This verification link doesn't match any certificate in our records.
              </p>
            </div>
          )}

          {loadState === 'ready' && result.status === 'VALID' && (
            <div>
              <div className="text-center mb-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-2xl mb-3">
                  ✓
                </div>
                <p className="font-semibold text-green-700">Valid Certificate</p>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-400">Employee</dt>
                  <dd className="font-medium text-slate-800">{result.employeeName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Event</dt>
                  <dd className="font-medium text-slate-800">{result.eventTitle}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Event Date</dt>
                  <dd className="font-medium text-slate-800">
                    {new Date(result.eventDate).toLocaleDateString()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Certificate No.</dt>
                  <dd className="font-medium text-slate-800">{result.certificateNumber}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Issued</dt>
                  <dd className="font-medium text-slate-800">
                    {new Date(result.issuedAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {loadState === 'ready' && result.status === 'REVOKED' && (
            <div>
              <div className="text-center mb-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-2xl mb-3">
                  ✗
                </div>
                <p className="font-semibold text-red-700">Revoked Certificate</p>
                <p className="text-sm text-slate-500 mt-1">This certificate is no longer valid.</p>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-400">Employee</dt>
                  <dd className="font-medium text-slate-800">{result.employeeName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Event</dt>
                  <dd className="font-medium text-slate-800">{result.eventTitle}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Certificate No.</dt>
                  <dd className="font-medium text-slate-800">{result.certificateNumber}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        <p className="text-center text-sm mt-4">
          <Link to="/" className="text-indigo-600 hover:underline">
            Go to homepage
          </Link>
        </p>
      </div>
    </div>
  );
}

export default CertificateVerifyPage;
