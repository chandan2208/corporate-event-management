import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import ConfirmModal from '../../components/ConfirmModal';
import { listAllCertificates, revokeCertificate } from '../../api/certificatesApi';
import { useToast } from '../../context/ToastContext';

function AdminCertificatesPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const status = searchParams.get('status') || '';

  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [revokeTarget, setRevokeTarget] = useState(null);

  const fetchCertificates = useCallback(() => {
    setLoadState('loading');
    listAllCertificates({ page, limit: 10, status: status || undefined })
      .then((result) => {
        setData(result);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, [page, status]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  const updateParams = (next) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      Object.entries(next).forEach(([key, value]) => {
        if (value) params.set(key, value);
        else params.delete(key);
      });
      return params;
    });
  };

  const handleConfirmRevoke = async () => {
    try {
      await revokeCertificate(revokeTarget.id);
      showToast('Certificate revoked');
      fetchCertificates();
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to revoke certificate', 'error');
    } finally {
      setRevokeTarget(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-slate-800">Certificates</h1>
          <select
            value={status}
            onChange={(e) => updateParams({ status: e.target.value, page: '1' })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">All statuses</option>
            <option value="VALID">Valid</option>
            <option value="REVOKED">Revoked</option>
          </select>
        </div>

        {loadState === 'loading' && <Spinner label="Loading certificates..." />}
        {loadState === 'error' && <EmptyState title="Couldn't load certificates" />}
        {loadState === 'ready' && data.certificates.length === 0 && (
          <EmptyState title="No certificates found" />
        )}

        {loadState === 'ready' && data.certificates.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Certificate No.</th>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Issued</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.certificates.map((cert) => (
                  <tr key={cert.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{cert.certificateNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{cert.employeeName}</td>
                    <td className="px-4 py-3 text-slate-500">{cert.event?.title}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(cert.issuedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full text-xs font-medium px-2.5 py-1 ${
                          cert.status === 'REVOKED' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {cert.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {cert.status === 'VALID' && (
                        <button
                          onClick={() => setRevokeTarget(cert)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 pb-4">
              <Pagination pagination={data.pagination} onPageChange={(p) => updateParams({ page: String(p) })} />
            </div>
          </div>
        )}
      </main>

      <ConfirmModal
        open={!!revokeTarget}
        title="Revoke this certificate?"
        message={`"${revokeTarget?.certificateNumber}" will be marked revoked. It cannot be downloaded by the employee afterward, and this cannot be undone.`}
        confirmLabel="Revoke"
        danger
        onCancel={() => setRevokeTarget(null)}
        onConfirm={handleConfirmRevoke}
      />
    </div>
  );
}

export default AdminCertificatesPage;
