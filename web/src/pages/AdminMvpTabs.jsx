import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, CheckCircle, XCircle, ChevronDown, ChevronUp, Printer, Flag, AlertTriangle, Ban } from 'lucide-react';
import ProtectedImage from '../components/ProtectedImage';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner, { PageLoader } from '../components/Spinner';
import { ErrorState } from '../components/EmptyState';
import TwoFactorRequired, { isTwoFactorError } from '../components/TwoFactorRequired';
import { api } from '../lib/api';
import { formatDate, formatPhone, formatPrice, ROLE_LABELS } from '../lib/format';
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES } from '../lib/support';
import { useToast } from '../context/ToastContext';

const DOCUMENT_LABELS = { passport: 'Pasport / ID', selfie: 'Selfi', certificate: 'Sertifikat' };

export function FilterChips({ options, value, onChange, counts = {} }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar" role="radiogroup" aria-label="Filtr">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={`chip border ${value === id ? 'chip-active border-blue-600' : 'bg-white border-slate-200'}`}
        >
          {label}
          {counts[id] > 0 && <span className={`text-[10px] px-1.5 rounded-full ${value === id ? 'bg-snow/25' : 'bg-slate-200'}`}>{counts[id]}</span>}
        </button>
      ))}
    </div>
  );
}

export function useAdminList(path) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null);
    return api(path).then(setResult).catch(setError);
  }, [path]);
  useEffect(() => {
    setResult(null);
    load();
  }, [load]);
  return { result, error, load };
}

/**
 * Ustalarni tasdiqlash navbati
 */
export function VerificationsTab({ onChanged }) {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const { result, error, load } = useAdminList(`/admin/verifications?status=${status}`);
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState('');

  if (isTwoFactorError(error)) return <TwoFactorRequired />;
  if (error) return <ErrorState message={error.message} onRetry={load} />;

  const decide = async (master, action) => {
    setBusy(master.id);
    try {
      const body = action === 'reject' ? { note } : undefined;
      const { message } = await api(`/admin/verifications/${master.id}/${action}`, { method: 'POST', body });
      toast.success(message);
      setRejecting(null);
      setNote('');
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <FilterChips
          options={[['pending', 'Tekshiruvda'], ['rejected', 'Rad etilgan'], ['none', 'Yubormagan']]}
          value={status}
          onChange={setStatus}
          counts={result?.counts}
        />
        <div className="flex gap-2">
          <Link to="/ustalar" className="btn btn-sm btn-ghost">Ustalar uchun qo'llanma</Link>
          <Link to="/ustalar/varaqa" className="btn btn-sm btn-soft"><Printer className="w-4 h-4" /> Usta jalb qilish varaqasi</Link>
        </div>
      </div>
      {!result && <PageLoader />}
      {result && result.data.length === 0 && (
        <p className="card p-8 text-center text-sm text-slate-400">
          {status === 'pending' ? 'Tasdiq kutayotgan usta yo\'q 🎉' : 'Ro\'yxat bo\'sh'}
        </p>
      )}
      {result?.data.map((m) => (
        <article key={m.id} className="card p-5 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900">{m.name || 'Ismsiz usta'}</h3>
              <p className="text-xs text-slate-500">
                {m.specializations.map((s) => `${s.icon} ${s.name_uz}`).join(', ') || 'Mutaxassislik tanlanmagan'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {m.district || 'Tuman yo\'q'} · {m.experience_years || 0} yil tajriba · {formatPrice(m.hourly_rate)} · portfolio: {m.portfolio_count}
              </p>
              {m.verification_requested_at && <p className="text-[11px] text-slate-400 mt-0.5">Yuborgan: {formatDate(m.verification_requested_at)}</p>}
              {m.verification_note && <p className="text-[11px] text-amber-700 mt-0.5">Oldingi rad sababi: {m.verification_note}</p>}
            </div>
            <a href={`tel:${m.phone}`} className="btn btn-sm btn-secondary min-h-10"><Phone className="w-4 h-4" /> {formatPhone(m.phone)}</a>
          </div>
          {m.bio && <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3">{m.bio}</p>}
          {m.documents.length > 0 ? (
            <div className="flex gap-3 flex-wrap">
              {m.documents.map((doc) => (
                <div key={doc.id} className="text-center">
                  <ProtectedImage path={`/admin/documents/${doc.id}`} alt={DOCUMENT_LABELS[doc.kind]} className="w-28 h-28" />
                  <span className="text-[11px] text-slate-500">{DOCUMENT_LABELS[doc.kind]}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Hujjat yuklanmagan</p>
          )}
          {rejecting === m.id ? (
            <div className="space-y-2">
              <label className="label" htmlFor={`reject-${m.id}`}>Rad etish sababi (ustaga ko'rinadi)</label>
              <textarea id={`reject-${m.id}`} className="input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: pasport rasmi xira, qayta yuklang" />
              <div className="flex gap-2">
                <button type="button" className="btn btn-danger flex-1" disabled={busy === m.id || note.trim().length < 5} onClick={() => decide(m, 'reject')}>
                  {busy === m.id ? <Spinner className="w-4 h-4 text-white" /> : 'Rad etish'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setRejecting(null)}>Bekor</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-success font-bold" disabled={Boolean(busy)} onClick={() => decide(m, 'approve')} aria-label={`${m.name}: tasdiqlash`}>
                {busy === m.id ? <Spinner className="w-4 h-4 text-white" /> : <><CheckCircle className="w-4 h-4" /> Tasdiqlash</>}
              </button>
              <button type="button" className="btn btn-secondary border-red-200 text-red-600 hover:bg-red-50" disabled={Boolean(busy)} onClick={() => { setRejecting(m.id); setNote(''); }}>
                <XCircle className="w-4 h-4" /> Rad etish
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

// Ogohlantirish matni uchun tayyor qoralama (admin o'zgartirishi mumkin)
const WARNING_TEMPLATES = {
  offsite_payment: 'Mijozlardan saytdan tashqari to\'lov yoki raqam so\'ramang. Barcha kelishuvlar Usta24 orqali bo\'lishi kerak.',
  fraud: 'Sizga firibgarlik (oldindan pul so\'rash) bo\'yicha shikoyat tushdi. Bunday holat qaytarilsa, hisobingiz bloklanadi.',
  fake_profile: 'Profilingizda boshqa odamning rasmi yoki noto\'g\'ri ma\'lumot borligi haqida shikoyat tushdi. 24 soat ichida profilingizni to\'g\'rilang.',
  wrong_info: 'Profilingizdagi ma\'lumotlar (soha, narx, tajriba) noto\'g\'ri ekani haqida shikoyat tushdi. Iltimos, profilingizni yangilang.',
  inappropriate: 'Profilingizda nomaqbul rasm yoki matn borligi haqida shikoyat tushdi. Ularni o\'chiring.',
  behavior: 'Sizga qo\'pol muomala haqida shikoyat tushdi. Mijozlar va ustalar bilan hurmat bilan muomala qiling.',
  master_no_show: 'Siz qabul qilgan buyurtmaga bormaganingiz haqida shikoyat tushdi. Bora olmasangiz, buyurtmani oldindan bekor qiling.',
  client_no_pay: 'Usta bajarilgan ish uchun to\'lov olmagani haqida shikoyat qildi. Iltimos, ustaga to\'lovni amalga oshiring.'
};

/**
 * Ogohlantirish yuborish: foydalanuvchiga saytda, Telegram'da va "Yordam" sahifasida ko'rinadi
 */
function WarningDialog({ ticket, onClose, onSent }) {
  const toast = useToast();
  const [message, setMessage] = useState(WARNING_TEMPLATES[ticket.category] || '');
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api(`/admin/users/${ticket.target_user_id}/warnings`, { method: 'POST', body: { message, ticket_id: ticket.id } });
      toast.success('Ogohlantirish yuborildi');
      onSent();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal onClose={sending ? () => {} : onClose} size="md" labelledBy="warning-title">
      <h3 id="warning-title" className="text-lg font-bold text-slate-900 pr-8">Ogohlantirish: {ticket.target_name || 'foydalanuvchi'}</h3>
      <p className="text-xs text-slate-500 mt-0.5">Saytda, Telegram'da va uning «Yordam» sahifasida ko'rinadi. Kim shikoyat qilgani aytilmaydi.</p>
      <form onSubmit={submit} className="space-y-3 mt-4">
        <textarea
          className="input"
          rows={4}
          required
          minLength={10}
          maxLength={1000}
          aria-label="Ogohlantirish matni"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button type="submit" disabled={sending || message.trim().length < 10} className="btn btn-primary w-full font-bold">
          {sending ? <Spinner className="w-4 h-4 text-white" /> : 'Ogohlantirish yuborish'}
        </button>
      </form>
    </Modal>
  );
}

/**
 * Shikoyat qilingan foydalanuvchi: unga qarshi jami shikoyatlar, ogohlantirishlar, bloklash
 */
function ComplaintTarget({ ticket, onWarn, onToggleBlock }) {
  const many = ticket.target_reporters >= 3;
  return (
    <div className={`rounded-xl border p-3 text-xs space-y-2 ${many ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/50'}`}>
      <p className="flex items-center gap-1.5 flex-wrap text-slate-700">
        <Flag className="w-3.5 h-3.5 text-red-500" aria-hidden="true" />
        <strong>Kimga qarshi:</strong> {ticket.target_name || 'Ismsiz'} ({ROLE_LABELS[ticket.target_role] || ticket.target_role})
        {ticket.target_phone && <> · <a href={`tel:${ticket.target_phone}`} className="link">{formatPhone(ticket.target_phone)}</a></>}
        {!ticket.target_is_active && <span className="px-2 py-0.5 rounded-full bg-slate-800 text-white font-bold">bloklangan</span>}
      </p>
      <p className={many ? 'text-red-700 font-semibold' : 'text-slate-600'}>
        {many && <AlertTriangle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" aria-hidden="true" />}
        Unga qarshi jami {ticket.target_complaints} ta shikoyat ({ticket.target_reporters} kishidan), ochiq: {ticket.target_open} · ogohlantirishlar: {ticket.target_warnings}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => onWarn(ticket)} disabled={!ticket.target_is_active}>
          <AlertTriangle className="w-4 h-4" /> Ogohlantirish
        </button>
        <button type="button" className={`btn btn-sm ${ticket.target_is_active ? 'btn-danger-soft' : 'btn-secondary'}`} onClick={() => onToggleBlock(ticket)}>
          <Ban className="w-4 h-4" /> {ticket.target_is_active ? 'Bloklash' : 'Blokdan chiqarish'}
        </button>
      </div>
    </div>
  );
}

/**
 * Murojaatlar: mijoz va ustalarning muammolari va shikoyatlari
 */
export function SupportTab({ onChanged }) {
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const [kind, setKind] = useState('all');
  const { result, error, load } = useAdminList(`/admin/support?status=${status}${kind === 'complaint' ? '&kind=complaint' : ''}`);
  const [replies, setReplies] = useState({});
  const [busy, setBusy] = useState(null);
  const [warning, setWarning] = useState(null);
  const [blocking, setBlocking] = useState(null);
  const [blockBusy, setBlockBusy] = useState(false);

  const toggleBlock = async () => {
    setBlockBusy(true);
    try {
      await api(`/admin/users/${blocking.target_user_id}`, { method: 'PATCH', body: { is_active: !blocking.target_is_active } });
      toast.success(blocking.target_is_active ? 'Foydalanuvchi bloklandi' : 'Blokdan chiqarildi');
      setBlocking(null);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBlockBusy(false);
    }
  };

  if (isTwoFactorError(error)) return <TwoFactorRequired />;
  if (error) return <ErrorState message={error.message} onRetry={load} />;

  const update = async (ticket, nextStatus) => {
    setBusy(`${ticket.id}:${nextStatus}`);
    try {
      await api(`/admin/support/${ticket.id}`, { method: 'PUT', body: { status: nextStatus, admin_reply: replies[ticket.id] || undefined } });
      toast.success(`#${ticket.number}: ${SUPPORT_STATUSES[nextStatus].label.toLowerCase()}`);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterChips
          options={Object.entries(SUPPORT_STATUSES).map(([id, s]) => [id, s.label])}
          value={status}
          onChange={setStatus}
          counts={result?.counts}
        />
        <FilterChips options={[['all', 'Hammasi'], ['complaint', 'Faqat shikoyatlar']]} value={kind} onChange={setKind} />
      </div>
      {!result && <PageLoader />}
      {result && result.data.length === 0 && <p className="card p-8 text-center text-sm text-slate-400">Murojaat yo'q</p>}
      {result?.data.map((t) => {
        const closed = t.status === 'resolved' || t.status === 'rejected';
        return (
          <article key={t.id} className="card p-5 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900">#{t.number} · {SUPPORT_CATEGORIES[t.category]?.label || t.category}</h3>
                <p className="text-xs text-slate-500">
                  {t.user_name || 'Ismsiz'} ({ROLE_LABELS[t.user_role]}) · {formatDate(t.created_at)}
                  {t.order_id && <> · <Link to={`/orders/${t.order_id}`} className="link">{t.order_title}</Link></>}
                </p>
              </div>
              <a href={`tel:${t.user_phone}`} className="btn btn-sm btn-secondary min-h-10"><Phone className="w-4 h-4" /> {formatPhone(t.user_phone)}</a>
            </div>
            {t.message
              ? <p className="text-sm text-slate-700 whitespace-pre-wrap break-words bg-slate-50 rounded-xl p-3">{t.message}</p>
              : <p className="text-xs text-slate-400">Izoh yozilmagan</p>}
            {t.target_user_id && <ComplaintTarget ticket={t} onWarn={setWarning} onToggleBlock={setBlocking} />}
            {closed ? (
              <p className="text-sm text-slate-600"><strong>Javob:</strong> {t.admin_reply} <span className="text-[11px] text-slate-400">— {t.handled_by_name}</span></p>
            ) : (
              <>
                <textarea
                  className="input"
                  rows={2}
                  maxLength={2000}
                  aria-label={`#${t.number} uchun javob`}
                  placeholder="Foydalanuvchiga javob (saytda va Telegram'da ko'rinadi)"
                  value={replies[t.id] ?? t.admin_reply ?? ''}
                  onChange={(e) => setReplies({ ...replies, [t.id]: e.target.value })}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {t.status === 'open' && (
                    <button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => update(t, 'in_progress')}>
                      {busy === `${t.id}:in_progress` ? <Spinner className="w-4 h-4" /> : 'Ko\'rib chiqyapman'}
                    </button>
                  )}
                  <button type="button" className="btn btn-success" disabled={Boolean(busy)} onClick={() => update(t, 'resolved')}>
                    {busy === `${t.id}:resolved` ? <Spinner className="w-4 h-4 text-white" /> : 'Hal qilindi'}
                  </button>
                  <button type="button" className="btn btn-secondary text-slate-600" disabled={Boolean(busy)} onClick={() => update(t, 'rejected')}>
                    {busy === `${t.id}:rejected` ? <Spinner className="w-4 h-4" /> : 'Rad etish'}
                  </button>
                </div>
              </>
            )}
          </article>
        );
      })}

      {warning && <WarningDialog ticket={warning} onClose={() => setWarning(null)} onSent={load} />}
      {blocking && (
        <ConfirmDialog
          title={blocking.target_is_active ? `${blocking.target_name || 'Foydalanuvchi'} bloklansinmi?` : `${blocking.target_name || 'Foydalanuvchi'} blokdan chiqarilsinmi?`}
          description={blocking.target_is_active
            ? 'Hisobga kirib bo\'lmaydi, usta katalogda ko\'rinmaydi va taklif olmaydi. Keyin blokdan chiqarish mumkin.'
            : 'Foydalanuvchi yana saytdan foydalana oladi.'}
          confirmLabel={blocking.target_is_active ? 'Bloklash' : 'Blokdan chiqarish'}
          tone={blocking.target_is_active ? 'danger' : 'primary'}
          loading={blockBusy}
          onConfirm={toggleBlock}
          onClose={() => setBlocking(null)}
        />
      )}
    </div>
  );
}

/**
 * Server va saytdagi xatolar (bir xili bitta qatorda sanaladi)
 */
export function ErrorsTab({ onChanged }) {
  const toast = useToast();
  const [resolved, setResolved] = useState('false');
  const { result, error, load } = useAdminList(`/admin/errors?resolved=${resolved}`);
  const [open, setOpen] = useState(null);

  if (isTwoFactorError(error)) return <TwoFactorRequired />;
  if (error) return <ErrorState message={error.message} onRetry={load} />;

  const resolve = async (entry) => {
    try {
      await api(`/admin/errors/${entry.id}/resolve`, { method: 'POST' });
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <FilterChips options={[['false', 'Ochiq'], ['true', 'Hal qilingan']]} value={resolved} onChange={setResolved} counts={{ false: result?.open }} />
      {!result && <PageLoader />}
      {result && result.data.length === 0 && <p className="card p-8 text-center text-sm text-slate-400">Xato yo'q 🎉</p>}
      {result && result.data.length > 0 && (
        <ul className="card divide-y divide-slate-100 overflow-hidden">
          {result.data.map((e) => (
            <li key={e.id} className="p-4 space-y-2">
              <div className="flex items-start gap-3">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border flex-shrink-0 ${e.source === 'server' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                  {e.source === 'server' ? 'Server' : 'Sayt'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 break-words">{e.message}</p>
                  <p className="text-[11px] text-slate-400">
                    {e.count} marta · oxirgi: {formatDate(e.last_seen)}{e.url ? ` · ${e.url}` : ''}
                  </p>
                </div>
                {!e.resolved && (
                  <button type="button" className="btn btn-sm btn-secondary min-h-10 flex-shrink-0" onClick={() => resolve(e)}>Hal qilindi</button>
                )}
              </div>
              {e.stack && (
                <button type="button" className="text-xs link inline-flex items-center gap-1 min-h-9" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                  {open === e.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Tafsilot
                </button>
              )}
              {open === e.id && (
                <pre className="text-[11px] bg-slate-50 rounded-xl p-3 overflow-x-auto text-slate-600 whitespace-pre-wrap break-all">{e.stack}{e.user_agent ? `\n\n${e.user_agent}` : ''}</pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
