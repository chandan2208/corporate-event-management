import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import { listMyCertificates, downloadCertificate } from '../../api/certificatesApi';
import { useToast } from '../../context/ToastContext';

function MyCertificatesPage() {
  const { showToast } = useToast();
  const [certificates, setCertificates] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    listMyCertificates()
      .then((data) => {
        setCertificates(data);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, []);

  const handleDownload = async (cert) => {
    setDownloadingId(cert.id);
    try {
      const blob = await downloadCertificate(cert.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cert.certificateNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to download certificate', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-lg font-semibold text-slate-800 mb-6">My Certificates</h1>

        {loadState === 'loading' && <Spinner label="Loading certificates..." />}
        {loadState === 'error' && (
          <EmptyState title="Couldn't load your certificates" description="Please try again." />
        )}
        {loadState === 'ready' && certificates.length === 0 && (
          <EmptyState
            title="No certificates yet"
            description="Certificates become available after you're checked in at an event."
            action={
              <Link to="/employee/my-registrations" className="text-sm font-medium text-indigo-600 hover:underline">
                View my registrations →
              </Link>
            }
          />
        )}

        {loadState === 'ready' && certificates.length > 0 && (
          <div className="space-y-3">
            {certificates.map((cert) => (
              <div key={cert.id} className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{cert.event?.title}</p>
                  <p className="text-sm text-slate-500 mt-1">Certificate No: {cert.certificateNumber}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Issued {new Date(cert.issuedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`inline-block rounded-full text-xs font-medium px-2.5 py-1 ${
                      cert.status === 'REVOKED' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {cert.status}
                  </span>
                  {cert.status !== 'REVOKED' && (
                    <button
                      onClick={() => handleDownload(cert)}
                      disabled={downloadingId === cert.id}
                      className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
                    >
                      {downloadingId === cert.id ? 'Downloading...' : 'Download PDF'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default MyCertificatesPage;
