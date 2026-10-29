import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Spinner from './Spinner';

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Tasdiqlash',
  tone = 'danger',
  loading = false,
  onConfirm,
  onClose
}) {
  const toneClass = { danger: 'btn-danger', success: 'btn-success' }[tone] || 'btn-primary';

  return (
    <Modal onClose={loading ? () => {} : onClose} size="sm" labelledBy="confirm-title">
      <div className="text-center pt-2">
        <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 id="confirm-title" className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
        {description && <p className="text-sm text-slate-500 mb-5">{description}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn btn-secondary"
          >
            Ortga
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`btn font-bold ${toneClass}`}
          >
            {loading ? <Spinner className="w-4 h-4 text-white" /> : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
