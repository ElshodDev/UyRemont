import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy, Phone, Send, Plus, MessageSquareReply } from 'lucide-react';
import SupportDialog from '../components/SupportDialog';
import EmptyState, { ErrorState } from '../components/EmptyState';
import { PageLoader } from '../components/Spinner';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES } from '../lib/support';
import { getSocket } from '../lib/socket';

/**
 * Yordam va murojaatlarim: aloqa, yuborilgan murojaatlar va administrator javoblari
 */
export default function SupportPage() {
  const [tickets, setTickets] = useState(null);
  const [contacts, setContacts] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    setError('');
    api('/support/my').then(({ data }) => setTickets(data)).catch((err) => setError(err.message));
  };

  useEffect(() => {
    load();
    api('/support/contacts').then(({ data }) => setContacts(data)).catch(() => {});
    // Administrator javob bersa ro'yxat yangilanadi
    const socket = getSocket();
    socket?.on('support_updated', load);
    return () => socket?.off('support_updated', load);
  }, []);

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 w-full flex-1 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600"><LifeBuoy className="w-6 h-6" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Yordam</h1>
          <p className="text-xs text-slate-500">Muammo bo'lsa yozing — administrator ko'rib chiqadi</p>
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

      <div className="card p-4 text-xs text-slate-600">
        Buyurtma bo'yicha muammo (usta kelmadi, narx oshdi, to'lov) bo'lsa, o'sha buyurtma sahifasidagi
        <strong> «Muammo haqida xabar berish»</strong> tugmasidan foydalaning — administrator buyurtma tafsilotlarini darhol ko'radi.
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-900">Murojaatlarim</h2>
        <button type="button" onClick={() => setCreating(true)} className="btn btn-sm btn-primary min-h-10">
          <Plus className="w-4 h-4" /> Yangi murojaat
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!tickets && !error && <PageLoader />}
      {tickets && tickets.length === 0 && (
        <EmptyState icon="📭" title="Murojaatlar yo'q" description="Biror muammo bo'lsa, «Yangi murojaat» tugmasini bosing." />
      )}
      {tickets && tickets.length > 0 && (
        <ul className="space-y-3">
          {tickets.map((t) => {
            const status = SUPPORT_STATUSES[t.status];
            return (
              <li key={t.id} className="card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">#{t.number} · {SUPPORT_CATEGORIES[t.category]?.label || t.category}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatDate(t.created_at)}
                      {t.order_id && <> · <Link to={`/orders/${t.order_id}`} className="link">{t.order_title || 'buyurtma'}</Link></>}
                    </p>
                  </div>
                  <span className={`inline-flex px-2.5 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap ${status.className}`}>{status.label}</span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{t.message}</p>
                {t.admin_reply && (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                    <p className="text-[11px] font-bold text-blue-700 flex items-center gap-1"><MessageSquareReply className="w-3.5 h-3.5" /> Administrator javobi</p>
                    <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap break-words">{t.admin_reply}</p>
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
