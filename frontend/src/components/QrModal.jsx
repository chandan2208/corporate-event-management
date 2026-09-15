import QrCodeCard from './QrCodeCard';

/**
 * Lightweight modal that shows a registration's QR code. Separate from
 * ConfirmModal since this has no confirm/cancel action — just a close
 * button — and renders QrCodeCard's own loading/error states inside.
 */
function QrModal({ open, registrationId, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Check-in QR Code</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-medium"
          >
            Close
          </button>
        </div>
        <QrCodeCard registrationId={registrationId} />
      </div>
    </div>
  );
}

export default QrModal;
