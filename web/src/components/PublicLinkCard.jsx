import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Copy, Send, QrCode, Pencil, Share2, ExternalLink, Printer } from 'lucide-react';
import Spinner from './Spinner';
import { api, BACKEND_URL } from '../lib/api';
import { copyText, shareLink, telegramShareUrl } from '../lib/share';
import { useToast } from '../context/ToastContext';

const SHARE_TEXT = 'Usta kerak bo\'lsa — mening Usta24 dagi profilim: sharhlar, ishlarim va narxlar';

/**
 * Usta: ommaviy havola (usta24.uz/u/<nom>), ulashish, QR kod va havola nomini o'zgartirish
 */
export default function PublicLinkCard() {
  const toast = useToast();
  const [link, setLink] = useState(null);
  const [editing, setEditing] = useState(false);
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/masters/me/link').then(({ data }) => setLink(data)).catch(() => setLink(false));
  }, []);

  if (link === false) return null;
  if (!link) return <div className="card p-5"><Spinner className="w-4 h-4" /></div>;

  // Sayt manzili brauzerdagi manzil bilan (backend PUBLIC_APP_URL bilan bir xil bo'lishi kerak)
  const url = `${window.location.origin}/u/${link.slug}`;
  const qrUrl = `${BACKEND_URL}/api/masters/u/${link.slug}/qr`;

  const copy = async () => {
    if (await copyText(url)) toast.success('Havola nusxalandi');
    else toast.error('Nusxalab bo\'lmadi');
  };

  const share = async () => {
    const result = await shareLink({ url, title: 'Usta24', text: SHARE_TEXT });
    if (result === 'copied') toast.success('Havola nusxalandi');
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api('/masters/me/link', { method: 'PUT', body: { slug } });
      setLink(data);
      setEditing(false);
      toast.success('Havola saqlandi');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card p-5 sm:p-6 space-y-4" aria-labelledby="public-link-title">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0" aria-hidden="true">
          <Link2 className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h2 id="public-link-title" className="font-bold text-slate-900">Ommaviy havolangiz</h2>
          <p className="text-xs text-slate-500">Telegram guruhlarda, vizitkada yoki mashinangizda ulashing — mijoz profilingizni ochib, to'g'ridan-to'g'ri buyurtma beradi.</p>
        </div>
      </div>

      {editing ? (
        <form onSubmit={save} className="space-y-2">
          <label className="label" htmlFor="public-slug">Havola nomi (lotin harflari, raqam, chiziqcha)</label>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-slate-400 whitespace-nowrap hidden sm:inline">{window.location.host}/u/</span>
            <input
              id="public-slug"
              className="input"
              required
              minLength={3}
              maxLength={40}
              pattern="[a-zA-Z0-9-]+"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary flex-1" disabled={saving}>{saving ? <Spinner className="w-4 h-4 text-white" /> : 'Saqlash'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Bekor</button>
          </div>
          <p className="hint">Nom o'zgarsa, eski havola ishlamay qoladi.</p>
        </form>
      ) : (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
          <a href={url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 text-sm font-semibold text-blue-600 truncate hover:underline">
            {url.replace(/^https?:\/\//, '')}
          </a>
          <button type="button" className="icon-btn" onClick={copy} aria-label="Havolani nusxalash" title="Nusxalash"><Copy className="w-4 h-4" /></button>
          <button type="button" className="icon-btn" onClick={() => { setSlug(link.slug); setEditing(true); }} aria-label="Havola nomini o'zgartirish" title="O'zgartirish">
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <a href={telegramShareUrl(url, SHARE_TEXT)} target="_blank" rel="noreferrer" className="btn text-white bg-[#229ED9] hover:bg-[#1c8cc2]">
          <Send className="w-4 h-4" /> Telegram'da ulashish
        </a>
        {typeof navigator !== 'undefined' && navigator.share && (
          <button type="button" onClick={share} className="btn btn-secondary">
            <Share2 className="w-4 h-4" /> Boshqa ilovada
          </button>
        )}
        <Link to="/master/varaqa" className="btn btn-secondary">
          <Printer className="w-4 h-4" /> Varaqa va vizitka
        </Link>
        <a href={qrUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">
          <QrCode className="w-4 h-4" /> QR kod (rasm)
        </a>
        <a href={url} target="_blank" rel="noreferrer" className="btn btn-ghost sm:hidden">
          <ExternalLink className="w-4 h-4" /> Ko'rish
        </a>
      </div>
    </section>
  );
}
