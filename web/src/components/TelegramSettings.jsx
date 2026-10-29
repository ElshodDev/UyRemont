import React, { useEffect, useRef, useState } from 'react';
import { Send, Bell, BellOff, Unlink, CheckCircle2 } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import Spinner from './Spinner';
import { api } from '../lib/api';
import { TELEGRAM_BUTTON, usePolling } from '../lib/telegram';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * Profil: Telegram'ni ulash, bildirishnomalarni yoqish/o'chirish va uzish
 */
export default function TelegramSettings() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [pendingLink, setPendingLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const sectionRef = useRef(null);

  const load = async () => {
    const { data } = await api('/auth/telegram');
    setInfo(data);
    return data;
  };

  useEffect(() => {
    load().catch(() => setInfo({ enabled: false }));
  }, []);

  useEffect(() => {
    if (info?.enabled && window.location.hash === '#telegram') {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [info?.enabled]);

  // Botda raqam yuborilishini kutish
  usePolling(async () => {
    const data = await load();
    if (data.link) {
      setPendingLink(null);
      toast.success('Telegram ulandi');
      refresh();
      return true;
    }
    return false;
  }, 2500, Boolean(pendingLink));

  if (!info?.enabled) return null;

  const startLink = async () => {
    setBusy(true);
    try {
      const { data } = await api('/auth/telegram/link', { method: 'POST' });
      setPendingLink(data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    setBusy(true);
    try {
      const { data, message } = await api('/auth/telegram', { method: 'PUT', body: { notifications: !info.link.notifications } });
      setInfo({ ...info, link: data });
      toast.success(message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    setBusy(true);
    try {
      await api('/auth/telegram', { method: 'DELETE' });
      setInfo({ ...info, link: null });
      setConfirmUnlink(false);
      toast.success('Telegram uzildi');
      refresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const benefit = user.role === 'master'
    ? 'Yangi buyurtmalar ilova yopiq bo\'lsa ham Telegram\'ga keladi va ularni o\'sha yerning o\'zida qabul qilasiz.'
    : 'Usta yo\'lga chiqqani, yetib kelgani va ish yakunlangani haqida Telegram\'da xabar olasiz. Kirish kodi ham SMS o\'rniga Telegram\'ga keladi.';

  return (
    <section id="telegram" ref={sectionRef} className="card p-5 sm:p-6 space-y-4 scroll-mt-24" aria-labelledby="telegram-title">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-[#229ED9] text-white flex items-center justify-center flex-shrink-0" aria-hidden="true">
          <Send className="w-5 h-5" />
        </span>
        <div>
          <h3 id="telegram-title" className="font-bold text-slate-900">Telegram</h3>
          <p className="text-xs text-slate-500">{benefit}</p>
        </div>
      </div>

      {info.link ? (
        <>
          <p className="text-sm text-slate-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Ulangan: <strong>{info.link.username ? `@${info.link.username}` : info.link.first_name}</strong>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button type="button" onClick={toggle} disabled={busy} className="btn btn-secondary" aria-pressed={info.link.notifications}>
              {info.link.notifications
                ? <><BellOff className="w-4 h-4" /> Xabarlarni o'chirish</>
                : <><Bell className="w-4 h-4" /> Xabarlarni yoqish</>}
            </button>
            <button type="button" onClick={() => setConfirmUnlink(true)} disabled={busy} className="btn btn-secondary border-red-200 text-red-600 hover:bg-red-50">
              <Unlink className="w-4 h-4" /> Uzish
            </button>
          </div>
          {!info.link.notifications && <p className="hint">Xabarlar o'chirilgan. Kirish kodlari baribir keladi.</p>}
        </>
      ) : pendingLink ? (
        <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-3">
          <ol className="text-xs text-slate-700 space-y-1 list-decimal pl-4">
            <li>«Telegram'ni ochish» tugmasini bosing</li>
            <li>Botda <strong>Start</strong> ni bosing</li>
            <li><strong>📱 Raqamni yuborish</strong> ni bosing</li>
          </ol>
          <a href={pendingLink.bot_url} target="_blank" rel="noreferrer" className={TELEGRAM_BUTTON}>
            <Send className="w-4 h-4" /> Telegram'ni ochish
          </a>
          <p className="text-xs text-slate-600 flex items-center gap-2" role="status">
            <Spinner className="w-3.5 h-3.5" /> Botda raqam yuborilishi kutilmoqda...
          </p>
        </div>
      ) : (
        <button type="button" onClick={startLink} disabled={busy} className={TELEGRAM_BUTTON}>
          {busy ? <Spinner className="w-4 h-4 text-white" /> : <><Send className="w-4 h-4" /> Telegram'ni ulash</>}
        </button>
      )}

      {confirmUnlink && (
        <ConfirmDialog
          title="Telegram uzilsinmi?"
          description="Xabarlar va kirish kodlari endi Telegram'ga kelmaydi. Istalgan vaqtda qayta ulashingiz mumkin."
          confirmLabel="Uzish"
          loading={busy}
          onConfirm={unlink}
          onClose={() => setConfirmUnlink(false)}
        />
      )}
    </section>
  );
}
