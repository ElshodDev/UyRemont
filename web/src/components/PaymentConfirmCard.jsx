import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Wallet } from 'lucide-react';
import Spinner from './Spinner';
import { api } from '../lib/api';
import { formatSum } from '../lib/commission';
import { useToast } from '../context/ToastContext';
import { t } from '../i18n';

const toSum = (value) => Number(String(value || '').replace(/\s/g, '')) || 0;

/**
 * Tezkor chaqiruv yakunlangach to'lovni tasdiqlash.
 * Mijoz: "Ha, shuncha to'ladim" yoki boshqa summani yozadi (javob ustaga ko'rsatilmaydi).
 * Usta: mijoz tasdiqlagan bo'lsa belgi. Telegram'dagi "Boshqa summa" tugmasi shu yerga (#tolov) olib keladi.
 */
export default function PaymentConfirmCard({ order, user, onDone }) {
  const toast = useToast();
  const ref = useRef(null);
  const [mode, setMode] = useState('ask');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isClient = order.client_id === user.id;
  const total = formatSum(order.final_price);

  useEffect(() => {
    // Telegram'dagi "Boshqa summa" tugmasi: summa maydoni darhol ochiladi
    if (window.location.hash === '#tolov' && order.can_confirm_payment) {
      setMode('other');
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [order.can_confirm_payment]);

  const send = async (body) => {
    setSubmitting(true);
    try {
      const { message } = await api(`/orders/${order.id}/payment`, { method: 'POST', body });
      toast.success(message);
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isClient) {
    if (!order.payment_confirmed_at) return null;
    return (
      <p className="card-pad flex items-center gap-2 text-sm font-semibold text-emerald-700">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> {t('Mijoz to\'lovni tasdiqladi')}
      </p>
    );
  }

  if (!order.can_confirm_payment) {
    if (!order.payment_confirmed_at) return null;
    return (
      <p className="card-pad flex items-center gap-2 text-sm text-slate-600">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" aria-hidden="true" />
        {t('Siz to\'lovni tasdiqladingiz: {sum}', { sum: formatSum(order.client_paid_amount) })}
      </p>
    );
  }

  return (
    <section ref={ref} id="tolov" aria-labelledby="payment-title" className="bg-white rounded-2xl border border-emerald-200 p-5 space-y-3 scroll-mt-24">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 flex-shrink-0"><Wallet className="w-5 h-5" aria-hidden="true" /></div>
        <div>
          <h3 id="payment-title" className="font-bold text-slate-900">{t('To\'lovni tasdiqlang')}</h3>
          <p className="text-sm text-slate-600 mt-0.5">
            {t('Usta yakuniy summani {sum} deb yozdi. Ustaga shuncha to\'ladingizmi?', { sum: total })}
          </p>
        </div>
      </div>

      {mode === 'ask' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button type="button" onClick={() => send({})} disabled={submitting} className="btn btn-success font-bold">
            {submitting ? <Spinner className="w-4 h-4 text-white" /> : t('Ha, {sum} to\'ladim', { sum: total })}
          </button>
          <button type="button" onClick={() => setMode('other')} disabled={submitting} className="btn btn-secondary">
            {t('Yo\'q, boshqa summa')}
          </button>
        </div>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            send({ amount: toSum(amount) });
          }}
        >
          <label className="label" htmlFor="paid-amount">{t('Ustaga qancha to\'ladingiz? (so\'m)')}</label>
          <input
            id="paid-amount"
            inputMode="numeric"
            required
            autoFocus
            className="input text-lg font-bold tabular-nums"
            placeholder={String(Math.round(Number(order.final_price) || 0))}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d\s]/g, ''))}
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={submitting || !toSum(amount)} className="btn btn-primary font-bold px-5">
              {submitting ? <Spinner className="w-4 h-4 text-white" /> : t('Yuborish')}
            </button>
            <button type="button" onClick={() => setMode('ask')} disabled={submitting} className="btn btn-ghost">
              {t('Ortga')}
            </button>
          </div>
        </form>
      )}

      <p className="hint">{t('Javobingiz ustaga ko\'rsatilmaydi. U narxlarning halol bo\'lishiga yordam beradi.')}</p>
    </section>
  );
}
