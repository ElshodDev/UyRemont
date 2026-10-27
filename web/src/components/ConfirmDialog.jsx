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
  const toneClass = tone === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : tone === 'success'
      ? 'bg-emerald-600 hover:bg-emerald-700'
      : 'bg-blue-600 hover:bg-blue-700';

  return (
    <Modal onClose={loading ? () => {} : onClose} size="sm">
      <div className="text-center pt-2">
        <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
        {description && <p className="text-sm text-slate-500 mb-5">{description}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Ortga
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-70 inline-flex items-center justify-center gap-2 ${toneClass}`}
          >
            {loading ? <Spinner className="w-4 h-4 text-white" /> : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
