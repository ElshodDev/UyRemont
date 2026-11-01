import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy, Phone, Send, Plus, MessageSquareReply, AlertTriangle, Flag } from 'lucide-react';
import SupportDialog from '../components/SupportDialog';
import EmptyState, { ErrorState } from '../components/EmptyState';
import { PageLoader } from '../components/Spinner';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES } from '../lib/support';
import { getSocket } from '../lib/socket';
import { t } from '../i18n';

// [qavs] ichidagi so'zlar qalin: tarjimada so'z tartibi o'zgarsa ham belgi o'z joyida qoladi
const withBold = (text) => text.split(/\[(.+?)\]/).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));

/**
 * Yordam va murojaatlarim: aloqa, yuborilgan murojaatlar va administrator javoblari
 */
export default function SupportPage() {
  const [tickets, setTickets] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [contacts, setContacts] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    setError('');
    api('/support/my')
      .then(({ data, warnings: list }) => {
        setTickets(data);
        setWarnings(list || []);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    load();
    api('/support/contacts').then(({ data }) => setContacts(data)).catch(() => {});
    // Administrator javob bersa ro'yxat yangilanadi
    const socket = getSocket();
    socket?.on('support_updated', load);
    socket?.on('account_warning', load);
    return () => {
      socket?.off('support_updated', load);
      socket?.off('account_warning', load);
    };
  }, []);

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 w-full flex-1 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600"><LifeBuoy className="w-6 h-6" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{t('Yordam')}</h1>
          <p className="text-xs text-slate-500">{t('Muammo bo\'lsa yozing — administrator ko\'rib chiqadi')}</p>
        </div>
      </div>

      {(contacts?.phone || contacts?.telegram) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {contacts.phone && (
            <a href={`tel:${contacts.phone.replace(/\s/g, '')}`} className="btn btn-secondary">
              <Phone className="w-4 h-4" /> {contacts.phone}
            </a>
          )}
          {contacts.telegram && (
            <a href={`https://t.me/${contacts.telegram}`} target="_blank" rel="noreferrer" className="btn text-white bg-[#229ED9] hover:bg-[#1c8cc2]">
              <Send className="w-4 h-4" /> @{contacts.telegram}
            </a>
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <section className="card p-4 sm:p-5 border-red-200 space-y-3" aria-labelledby="warnings-title">
          <h2 id="warnings-title" className="font-bold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" /> {t('Administrator ogohlantirishlari')}
          </h2>
          <ul className="space-y-2">
            {warnings.map((w) => (
              <li key={w.id} className="rounded-xl bg-red-50 border border-red-100 p-3">
                <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{w.message}</p>
                <p className="text-[11px] text-slate-500 mt-1">{formatDate(w.created_at)}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-600">
            {t('Takrorlansa, hisobingiz bloklanishi mumkin.')} <Link to="/rules" className="link">{t('Ishlash qoidalari')}</Link>
          </p>
        </section>
      )}

      <div className="card p-4 text-xs text-slate-600">
        {withBold(t('Buyurtma bo\'yicha muammo (usta kelmadi, narx oshdi, to\'lov) bo\'lsa, o\'sha buyurtma sahifasidagi [«Muammo haqida xabar berish»] tugmasidan foydalaning — administrator buyurtma tafsilotlarini darhol ko\'radi.'))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-900">{t('Murojaatlarim')}</h2>
        <button type="button" onClick={() => setCreating(true)} className="btn btn-sm btn-primary min-h-10">
          <Plus className="w-4 h-4" /> {t('Yangi murojaat')}
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!tickets && !error && <PageLoader />}
      {tickets && tickets.length === 0 && (
        <EmptyState icon="📭" title={t('Murojaatlar yo\'q')} description={t('Biror muammo bo\'lsa, «Yangi murojaat» tugmasini bosing.')} />
      )}
      {tickets && tickets.length > 0 && (
        <ul className="space-y-3">
          {tickets.map((ticket) => {
            const status = SUPPORT_STATUSES[ticket.status];
            const category = SUPPORT_CATEGORIES[ticket.category];
            return (
              <li key={ticket.id} className="card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">#{ticket.number} · {category ? t(category.label) : ticket.category}</p>
                    {ticket.target_name && (
                      <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                        <Flag className="w-3 h-3 text-red-500" aria-hidden="true" /> {t('Shikoyat: {name}', { name: ticket.target_name })}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400">
                      {formatDate(ticket.created_at)}
                      {ticket.order_id && <> · <Link to={`/orders/${ticket.order_id}`} className="link">{ticket.order_title || t('buyurtma')}</Link></>}
                    </p>
                  </div>
                  <span className={`inline-flex px-2.5 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap ${status.className}`}>{t(status.label)}</span>
                </div>
                {ticket.message && <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{ticket.message}</p>}
                {ticket.admin_reply && (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                    <p className="text-[11px] font-bold text-blue-700 flex items-center gap-1"><MessageSquareReply className="w-3.5 h-3.5" /> {t('Administrator javobi')}</p>
                    <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap break-words">{ticket.admin_reply}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {creating && <SupportDialog onClose={() => setCreating(false)} onCreated={load} />}
    </main>
  );
}
