import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Copy, ReceiptText, ArrowDownLeft, ArrowUpRight, SlidersHorizontal, Info } from 'lucide-react';
import { PageLoader } from '../components/Spinner';
import { ErrorState } from '../components/EmptyState';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { copyText } from '../lib/share';
import { getSocket } from '../lib/socket';
import { ENTRY_LABELS, PAYMENT_METHOD_LABELS, debtStatus, formatSum } from '../lib/commission';
import { useToast } from '../context/ToastContext';

const TONES = {
  ok: 'from-emerald-600 to-teal-600',
  normal: 'from-slate-700 to-slate-900',
  warn: 'from-amber-500 to-orange-600',
  blocked: 'from-red-600 to-rose-700'
};

const ENTRY_ICONS = { commission: ArrowUpRight, payment: ArrowDownLeft, adjustment: SlidersHorizontal };

function EntryRow({ entry }) {
  const Icon = ENTRY_ICONS[entry.kind];
  const detail = entry.kind === 'commission'
    ? `${entry.order_title || 'Buyurtma'} · ish haqi ${formatSum(entry.base_amount)} × ${entry.percent}%${entry.materials_price > 0 ? ` · material ${formatSum(entry.materials_price)} (komissiyasiz)` : ''}`
    : entry.kind === 'payment'
      ? [PAYMENT_METHOD_LABELS[entry.method], entry.note].filter(Boolean).join(' · ')
      : entry.note;
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${entry.amount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}
        aria-hidden="true"
      >
        <Icon className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">
          {ENTRY_LABELS[entry.kind]}
          {entry.order_id && <Link to={`/orders/${entry.order_id}`} className="link font-normal text-xs ml-2">buyurtma</Link>}
        </p>
        <p className="text-xs text-slate-500 truncate">{detail}</p>
        <p className="text-[11px] text-slate-400">{formatDate(entry.created_at)}</p>
      </div>
      <span className={`text-sm font-bold tabular-nums whitespace-nowrap ${entry.amount > 0 ? 'text-slate-900' : 'text-emerald-700'}`}>
        {formatSum(entry.amount, { sign: true })}
      </span>
    </li>
  );
}

/**
 * Usta: komissiya hisobi - qarz, limit, to'lov rekvizitlari va yozuvlar tarixi
 */
export default function MasterBalancePage() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    return api('/masters/me/commission').then(({ data: result }) => setData(result)).catch(setError);
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket();
    socket?.on('commission_updated', load);
    return () => socket?.off('commission_updated', load);
  }, [load]);

  if (error && !data) return <main className="max-w-3xl mx-auto px-4 py-10 w-full flex-1"><ErrorState message={error.message} onRetry={load} /></main>;
  if (!data) return <PageLoader />;

  const status = debtStatus(data.due, data.limit);
  const progress = data.limit > 0 ? Math.min(100, Math.max(0, (data.due / data.limit) * 100)) : 0;

  const copyInfo = async () => {
    if (await copyText(data.payment_info)) toast.success('Rekvizitlar nusxalandi');
  };

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 w-full flex-1 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600"><Wallet className="w-6 h-6" aria-hidden="true" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Komissiya hisobi</h1>
          <p className="text-xs text-slate-500">Tezkor chaqiruv orqali yakunlangan ishlardan {data.percent}%</p>
        </div>
      </div>

      <section className={`rounded-3xl p-6 text-white bg-gradient-to-r ${TONES[status.tone]}`} aria-labelledby="due-title">
        <p id="due-title" className="text-xs font-semibold uppercase tracking-wider text-white/75">Joriy qarz</p>
        <p className="text-4xl font-black mt-1 tabular-nums">{formatSum(Math.max(0, data.due))}</p>
        <p className="text-sm text-white/85 mt-1">{status.text}</p>
        {data.limit > 0 && (
          <div className="mt-4">
            <div
              className="h-2 rounded-full bg-white/25 overflow-hidden"
              role="progressbar"
              aria-label="Limitdan foydalanilgan qism"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-snow" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[11px] text-white/75 mt-1.5">Limit: {formatSum(data.limit)}</p>
          </div>
        )}
      </section>

      <section className="card p-5" aria-labelledby="pay-title">
        <h2 id="pay-title" className="font-bold text-slate-900 flex items-center gap-2"><ReceiptText className="w-5 h-5 text-blue-600" aria-hidden="true" /> Qanday to'lanadi</h2>
        {data.payment_info ? (
          <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
            <p className="flex-1 text-sm text-slate-800 font-medium whitespace-pre-line break-words">{data.payment_info}</p>
            <button type="button" className="icon-btn flex-shrink-0" onClick={copyInfo} aria-label="Rekvizitlarni nusxalash" title="Nusxalash">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">To'lov rekvizitlarini administrator bilan aniqlang: <Link to="/support" className="link">Yordam</Link>.</p>
        )}
        <p className="mt-3 text-xs text-slate-500 flex gap-2">
          <Info className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          To'lovni administrator qabul qilgach, qarz shu yerda kamayadi va sizga xabar keladi.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-[11px] font-semibold text-slate-500">Jami komissiya</p>
          <p className="text-lg font-black text-slate-900 tabular-nums">{formatSum(data.totals.commission)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold text-slate-500">Jami to'langan</p>
          <p className="text-lg font-black text-slate-900 tabular-nums">{formatSum(data.totals.paid)}</p>
          {data.totals.last_payment_at && <p className="text-[11px] text-slate-400">oxirgisi {formatDate(data.totals.last_payment_at, false)}</p>}
        </div>
      </div>

      <section className="card p-5" aria-labelledby="history-title">
        <h2 id="history-title" className="font-bold text-slate-900">Tarix</h2>
        {data.entries.length === 0 ? (
          <p className="text-sm text-slate-400 mt-2">Hali yozuv yo'q. Tezkor chaqiruvni yakunlaganingizda komissiya shu yerda ko'rinadi.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.entries.map((entry) => <EntryRow key={entry.id} entry={entry} />)}
          </ul>
        )}
      </section>
    </main>
  );
}
