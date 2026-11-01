import React, { useEffect, useState } from 'react';
import { Wallet, Search, Phone, AlertTriangle, ChevronDown, ChevronUp, SlidersHorizontal, CircleDollarSign } from 'lucide-react';
import Modal from '../components/Modal';
import Spinner, { PageLoader } from '../components/Spinner';
import { ErrorState } from '../components/EmptyState';
import { api } from '../lib/api';
import { formatDate, formatPhone } from '../lib/format';
import { ENTRY_LABELS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, formatSum } from '../lib/commission';
import { FilterChips, useAdminList } from './AdminMvpTabs';
import { useToast } from '../context/ToastContext';

/**
 * To'lov qabul qilish yoki hisobni tuzatish oynasi
 */
function LedgerDialog({ master, mode, onClose, onSaved }) {
  const toast = useToast();
  const isPayment = mode === 'payment';
  const [amount, setAmount] = useState(isPayment && master.commission_due > 0 ? String(Math.round(master.commission_due)) : '');
  const [direction, setDirection] = useState('decrease');
  const [method, setMethod] = useState('card');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const sum = Number(String(amount).replace(/\s/g, ''));
      const { message } = isPayment
        ? await api(`/admin/commission/${master.id}/payments`, { method: 'POST', body: { amount: sum, method, note } })
        : await api(`/admin/commission/${master.id}/adjustments`, {
          method: 'POST', body: { amount: direction === 'decrease' ? -sum : sum, note }
        });
      toast.success(message);
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={saving ? () => {} : onClose} size="sm" labelledBy="ledger-title">
      <h3 id="ledger-title" className="text-lg font-bold text-slate-900 pr-8">{isPayment ? 'To\'lov qabul qilish' : 'Hisobni tuzatish'}</h3>
      <p className="text-sm text-slate-500 mt-0.5">{master.name} · joriy qarz {formatSum(master.commission_due)}</p>
      <form onSubmit={submit} className="space-y-4 mt-4">
        {!isPayment && (
          <fieldset>
            <legend className="label">Qarz</legend>
            <div className="grid grid-cols-2 gap-2">
              {[['decrease', 'Kamaytirish'], ['increase', 'Oshirish']].map(([id, label]) => (
                <label key={id} className={`flex items-center gap-2 min-h-11 px-3 rounded-xl border cursor-pointer text-sm ${direction === id ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
                  <input type="radio" name="direction" className="accent-blue-600" checked={direction === id} onChange={() => setDirection(id)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div>
          <label className="label" htmlFor="ledger-amount">Summa (so'm)</label>
          <input
            id="ledger-amount"
            className="input tabular-nums"
            inputMode="numeric"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d\s]/g, ''))}
            placeholder="50 000"
          />
        </div>
        {isPayment && (
          <div>
            <label className="label" htmlFor="ledger-method">To'lov usuli</label>
            <select id="ledger-method" className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="ledger-note">{isPayment ? 'Izoh (ixtiyoriy)' : 'Sabab'}</label>
          <input
            id="ledger-note"
            className="input"
            required={!isPayment}
            minLength={isPayment ? undefined : 5}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isPayment ? 'masalan: Uzcard, chek №123' : 'masalan: birinchi oy chegirmasi'}
          />
        </div>
        <p className="hint">Usta xabarnoma oladi, amal jurnalga yoziladi.</p>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
            {saving ? <Spinner className="w-4 h-4 text-white" /> : isPayment ? 'Qabul qilish' : 'Saqlash'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Bekor</button>
        </div>
      </form>
    </Modal>
  );
}

function History({ masterId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api(`/admin/commission/${masterId}`).then(({ data: result }) => setData(result)).catch(setError);
  }, [masterId]);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;
  if (!data) return <Spinner className="w-4 h-4" />;
  if (data.entries.length === 0) return <p className="text-sm text-slate-400">Yozuv yo'q</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-slate-500 text-left">
          <tr>
            <th className="py-1.5 pr-3 font-semibold">Sana</th>
            <th className="py-1.5 pr-3 font-semibold">Turi</th>
            <th className="py-1.5 pr-3 font-semibold">Tafsilot</th>
            <th className="py-1.5 font-semibold text-right">Summa</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {data.entries.map((e) => (
            <tr key={e.id}>
              <td className="py-1.5 pr-3 whitespace-nowrap">{formatDate(e.created_at)}</td>
              <td className="py-1.5 pr-3">{ENTRY_LABELS[e.kind]}</td>
              <td className="py-1.5 pr-3">
                {e.kind === 'commission'
                  ? `${e.order_title || 'Buyurtma'} · ${formatSum(e.base_amount)} × ${e.percent}%`
                  : [PAYMENT_METHOD_LABELS[e.method], e.note].filter(Boolean).join(' · ')}
              </td>
              <td className={`py-1.5 text-right tabular-nums font-semibold whitespace-nowrap ${e.amount > 0 ? '' : 'text-emerald-700'}`}>{formatSum(e.amount, { sign: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryTile({ label, value, hint, warn }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className={`text-lg font-black tabular-nums mt-0.5 ${warn ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

/**
 * Admin: komissiya hisobi - ustalar qarzi, to'lovlarni qabul qilish, tuzatishlar
 */
export default function AdminCommissionTab({ onChanged }) {
  const [filter, setFilter] = useState('debtors');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState(null);
  const [open, setOpen] = useState(null);
  const params = new URLSearchParams({ filter, ...(query && { q: query }) });
  const { result, error, load } = useAdminList(`/admin/commission?${params}`);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const saved = () => {
    load();
    onChanged?.();
    setOpen(null);
  };

  if (error && !result) return <ErrorState message={error.message} onRetry={load} />;
  const summary = result?.summary;

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryTile label="Jami qarz" value={formatSum(summary.total_due)} hint={`${summary.debtors} ta usta`} />
          <SummaryTile
            label="Limitdan oshgan"
            value={summary.limit > 0 ? summary.over_limit : '—'}
            hint={summary.limit > 0 ? `limit ${formatSum(summary.limit)}` : 'limit o\'chirilgan'}
            warn={summary.over_limit > 0}
          />
          <SummaryTile label="30 kunda yozildi" value={formatSum(summary.accrued_30d)} hint={`komissiya ${summary.percent}%`} />
          <SummaryTile label="30 kunda yig'ildi" value={formatSum(summary.collected_30d)} />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <FilterChips
          options={[['debtors', 'Qarzdorlar'], ['over_limit', 'Limitdan oshgan'], ['all', 'Barcha ustalar']]}
          value={filter}
          onChange={setFilter}
          counts={result?.counts}
        />
        <label className="relative w-full sm:w-64">
          <span className="sr-only">Ism yoki telefon bo'yicha qidirish</span>
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ism yoki telefon" />
        </label>
      </div>

      {!result && <PageLoader />}
      {result && result.data.length === 0 && (
        <p className="card p-8 text-center text-sm text-slate-400">
          {filter === 'debtors' ? 'Qarzdor usta yo\'q 🎉' : 'Ro\'yxat bo\'sh'}
        </p>
      )}

      {result?.data.map((m) => (
        <article key={m.id} className={`card p-4 sm:p-5 space-y-3 ${m.over_limit ? 'border-red-200' : ''}`}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="font-bold text-slate-900 flex items-center gap-2">
                {m.name || 'Ismsiz usta'}
                {m.over_limit && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" aria-hidden="true" /> limitdan oshgan
                  </span>
                )}
              </p>
              <a href={`tel:${m.phone}`} className="text-xs text-slate-500 inline-flex items-center gap-1 hover:text-blue-600">
                <Phone className="w-3 h-3" aria-hidden="true" /> {formatPhone(m.phone)}
              </a>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Jami komissiya {formatSum(m.commission_total)} · to'langan {formatSum(m.paid_total)}
                {m.last_payment_at && ` · oxirgi to'lov ${formatDate(m.last_payment_at, false)}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold text-slate-500">Qarz</p>
              <p className={`text-xl font-black tabular-nums ${m.over_limit ? 'text-red-600' : 'text-slate-900'}`}>{formatSum(m.commission_due)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setDialog({ master: m, mode: 'payment' })}>
              <CircleDollarSign className="w-4 h-4" /> To'lov qabul qilish
            </button>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setDialog({ master: m, mode: 'adjustment' })}>
              <SlidersHorizontal className="w-4 h-4" /> Tuzatish
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              aria-expanded={open === m.id}
              onClick={() => setOpen((id) => (id === m.id ? null : m.id))}
            >
              {open === m.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} Tarix
            </button>
          </div>
          {open === m.id && <History masterId={m.id} />}
        </article>
      ))}

      {result && (
        <p className="hint flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
          Komissiya tezkor chaqiruv yakunlanganda yoziladi. To'lov rekvizitlari va limit: .env dagi COMMISSION_PAYMENT_INFO va COMMISSION_DEBT_LIMIT.
        </p>
      )}

      {dialog && <LedgerDialog master={dialog.master} mode={dialog.mode} onClose={() => setDialog(null)} onSaved={saved} />}
    </div>
  );
}
