import React, { useState } from 'react';
import Modal from './Modal';
import Spinner from './Spinner';
import { formatSum } from '../lib/commission';
import { t } from '../i18n';

const toSum = (value) => Number(String(value || '').replace(/\s/g, '')) || 0;

/**
 * Ishni yakunlash: ish haqi (chiqish narxi bilan) va material alohida. Komissiya faqat ish haqidan
 */
export default function CompleteDialog({ callFee, commissionPercent, onConfirm, onClose, title, description }) {
  // Tezkor chaqiruvda chiqish narxi oldindan yoziladi, oddiy buyurtmada bo'sh
  const [labor, setLabor] = useState(Number(callFee) > 0 ? String(Math.round(Number(callFee))) : '');
  const [materials, setMaterials] = useState('');
  const [loading, setLoading] = useState(false);
  const laborSum = toSum(labor);
  const materialsSum = toSum(materials);
  const commission = Math.round((laborSum * (commissionPercent || 0)) / 100);

  return (
    <Modal onClose={loading ? () => {} : onClose} size="sm" labelledBy="complete-title">
      <h3 id="complete-title" className="text-lg font-bold text-slate-900 mb-1">{title || t('Ishni yakunlash')}</h3>
      <p className="text-xs text-slate-500 mb-4">{description || t('Mijoz bilan kelishilgan summani kiriting. Material uchun alohida maydon bor: undan komissiya olinmaydi.')}</p>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          try {
            await onConfirm({ labor_price: laborSum, materials_price: materialsSum });
          } finally {
            setLoading(false);
          }
        }}
      >
        <div>
          <label className="label" htmlFor="labor-price">{t('Ish haqi (chiqish narxi bilan)')}</label>
          <input
            id="labor-price"
            inputMode="numeric"
            required
            autoFocus
            className="input text-lg font-bold tabular-nums"
            value={labor}
            onChange={(e) => setLabor(e.target.value.replace(/[^\d\s]/g, ''))}
          />
        </div>
        <div>
          <label className="label" htmlFor="materials-price">{t('Material (siz sotib olgan qismlar)')}</label>
          <input
            id="materials-price"
            inputMode="numeric"
            className="input tabular-nums"
            placeholder="0"
            value={materials}
            onChange={(e) => setMaterials(e.target.value.replace(/[^\d\s]/g, ''))}
            aria-describedby="materials-hint"
          />
          <p id="materials-hint" className="hint mt-1">{t('Mijoz summani ish haqi va material bo\'yicha alohida ko\'radi.')}</p>
        </div>
        <dl className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm space-y-1">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">{t('Mijoz to\'laydi')}</dt>
            <dd className="font-black text-slate-900 tabular-nums">{formatSum(laborSum + materialsSum)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">{t('Komissiya ({percent}% ish haqidan)', { percent: commissionPercent || 0 })}</dt>
            <dd className="font-semibold text-slate-700 tabular-nums">{formatSum(commission)}</dd>
          </div>
        </dl>
        <p className="hint">{t('Mijozdan ham to\'langan summani tasdiqlash so\'raladi.')}</p>
        <button type="submit" disabled={loading || labor === ''} className="btn btn-success w-full min-h-12 font-bold">
          {loading ? <Spinner className="w-4 h-4 text-white" /> : t('Yakunlash')}
        </button>
      </form>
    </Modal>
  );
}
