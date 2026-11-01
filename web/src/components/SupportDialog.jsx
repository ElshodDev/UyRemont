import React, { useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import Modal from './Modal';
import Spinner from './Spinner';
import { api } from '../lib/api';
import { categoriesFor } from '../lib/support';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { t } from '../i18n';

/**
 * Murojaat yuborish: buyurtma sahifasidan (orderId bilan) yoki "Murojaatlarim" dan
 */
export default function SupportDialog({ orderId, orderTitle, onClose, onCreated }) {
  const { user } = useAuth();
  const toast = useToast();
  const categories = categoriesFor(user.role, Boolean(orderId));
  const [category, setCategory] = useState(categories[0]?.id || 'other');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const { data, message: text } = await api('/support', { method: 'POST', body: { category, message, order_id: orderId } });
      toast.success(text);
      onCreated?.(data);
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal onClose={sending ? () => {} : onClose} size="md" labelledBy="support-title">
      <div className="flex items-center gap-3 mb-4 pr-8">
        <span className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0"><LifeBuoy className="w-6 h-6" /></span>
        <div className="min-w-0">
          <h3 id="support-title" className="text-lg font-bold text-slate-900">{t('Muammo haqida xabar berish')}</h3>
          <p className="text-xs text-slate-500 truncate">{orderTitle ? t('Buyurtma: {title}', { title: orderTitle }) : t('Administratorga murojaat')}</p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="label">{t('Nima bo\'ldi?')}</legend>
          <div className="space-y-2">
            {categories.map((c) => (
              <label key={c.id} className={`flex items-center gap-2 min-h-11 px-3 rounded-xl border cursor-pointer text-sm ${category === c.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
                <input type="radio" name="category" className="accent-blue-600" checked={category === c.id} onChange={() => setCategory(c.id)} />
                {t(c.label)}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="support-message">{t('Batafsil yozing')}</label>
          <textarea
            id="support-message"
            className="input"
            rows={4}
            required
            minLength={10}
            maxLength={2000}
            placeholder={t('Nima bo\'ldi, qachon, kelishilgan narx qancha edi...')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="hint mt-1">{t('Administrator ko\'rib chiqadi va javobni shu yerda (Profil → Murojaatlarim) hamda Telegram\'da yuboradi.')}</p>
        </div>
        <button type="submit" disabled={sending || message.trim().length < 10} className="btn btn-primary w-full min-h-12 font-bold">
          {sending ? <Spinner className="w-4 h-4 text-white" /> : t('Yuborish')}
        </button>
      </form>
    </Modal>
  );
}
