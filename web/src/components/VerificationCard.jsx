import React, { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Clock, AlertTriangle, ShieldQuestion, Upload, Trash2, CheckCircle, XCircle } from 'lucide-react';
import ProtectedImage from './ProtectedImage';
import Spinner from './Spinner';
import { api } from '../lib/api';
import { downscaleImage } from '../lib/images';
import { getSocket } from '../lib/socket';
import { useToast } from '../context/ToastContext';

const KINDS = [
  { id: 'passport', label: 'Pasport yoki ID karta', hint: 'Majburiy: ism va rasm aniq ko\'rinsin' },
  { id: 'selfie', label: 'Hujjat bilan selfi', hint: 'Tavsiya etiladi: tekshiruv tezlashadi' },
  { id: 'certificate', label: 'Sertifikat yoki diplom', hint: 'Ixtiyoriy' }
];

const STATUS_VIEW = {
  none: { icon: ShieldQuestion, title: 'Profil tasdiqlanmagan', text: 'Tezkor buyurtmalar faqat tasdiqlangan ustalarga yuboriladi. Hujjat yuklab, tekshiruvga yuboring.', tone: 'bg-slate-50 border-slate-200 text-slate-700' },
  pending: { icon: Clock, title: 'Tekshirilmoqda', text: 'Odatda 24 soat ichida ko\'rib chiqiladi. Natija shu yerda va Telegram\'da chiqadi.', tone: 'bg-blue-50 border-blue-200 text-blue-800' },
  rejected: { icon: AlertTriangle, title: 'Tasdiqlanmadi', text: '', tone: 'bg-amber-50 border-amber-200 text-amber-800' },
  verified: { icon: BadgeCheck, title: 'Profil tasdiqlangan', text: 'Mijozlar profilingizda ✓ belgisini ko\'radi va siz tezkor buyurtmalar olasiz.', tone: 'bg-emerald-50 border-emerald-200 text-emerald-800' }
};

/**
 * Usta: tasdiqlash holati, hujjatlar va tekshiruvga yuborish
 */
export default function VerificationCard() {
  const toast = useToast();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(null);
  const inputs = useRef({});

  const load = () => api('/masters/me/verification').then(({ data }) => setState(data)).catch(() => setState(false));

  // /master/profile#tasdiqlash havolasi bilan kelganda shu bo'limga o'tish
  useEffect(() => {
    if (state && window.location.hash === '#tasdiqlash') {
      document.getElementById('tasdiqlash')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [Boolean(state)]);

  useEffect(() => {
    load();
    const socket = getSocket();
    socket?.on('verification_updated', load);
    return () => socket?.off('verification_updated', load);
  }, []);

  if (state === false) return null;
  if (!state) return <div className="card p-5"><Spinner className="w-4 h-4" /></div>;

  const view = STATUS_VIEW[state.status];
  const Icon = view.icon;
  const editable = state.status !== 'verified' && state.status !== 'pending';

  const upload = async (kind, file) => {
    if (!file) return;
    setBusy(kind);
    try {
      const form = new FormData();
      form.append('kind', kind);
      form.append('image', await downscaleImage(file), 'document.jpg');
      await api('/masters/me/documents', { method: 'POST', body: form });
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(null);
      if (inputs.current[kind]) inputs.current[kind].value = '';
    }
  };

  const remove = async (id) => {
    setBusy(id);
    try {
      await api(`/masters/me/documents/${id}`, { method: 'DELETE' });
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    setBusy('submit');
    try {
      const { message } = await api('/masters/me/verification', { method: 'POST' });
      toast.success(message);
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(null);
    }
  };

  const req = state.requirements;

  return (
    <section id="tasdiqlash" className="card p-5 sm:p-6 space-y-4 scroll-mt-24" aria-labelledby="verification-title">
      <div className={`p-4 rounded-2xl border flex gap-3 ${view.tone}`}>
        <Icon className="w-6 h-6 flex-shrink-0" aria-hidden="true" />
        <div>
          <h2 id="verification-title" className="font-bold">{view.title}</h2>
          <p className="text-xs mt-0.5">{state.status === 'rejected' ? `Sabab: ${state.note}. Kamchilikni tuzatib, qayta yuboring.` : view.text}</p>
        </div>
      </div>

      {state.status !== 'verified' && (
        <>
          <ul className="space-y-1.5 text-sm">
            {[
              [req.has_name, 'Ism kiritilgan'],
              [req.has_specializations, 'Kamida bitta mutaxassislik tanlangan (pastdagi formada)'],
              [req.has_passport, 'Pasport yoki ID karta rasmi yuklangan']
            ].map(([ok, text]) => (
              <li key={text} className={`flex items-center gap-2 ${ok ? 'text-emerald-700' : 'text-slate-500'}`}>
                {ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {text}
              </li>
            ))}
          </ul>

          <div className="space-y-3">
            {KINDS.map((kind) => {
              const docs = state.documents.filter((d) => d.kind === kind.id);
              return (
                <div key={kind.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800">{kind.label}</p>
                      <p className="hint">{kind.hint}</p>
                    </div>
                    {editable && (
                      <label className="btn btn-sm btn-secondary min-h-10 cursor-pointer flex-shrink-0">
                        {busy === kind.id ? <Spinner className="w-4 h-4" /> : <Upload className="w-4 h-4" />} Yuklash
                        <input
                          ref={(el) => { inputs.current[kind.id] = el; }}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/*"
                          className="sr-only"
                          disabled={Boolean(busy)}
                          onChange={(e) => upload(kind.id, e.target.files?.[0])}
                        />
                      </label>
                    )}
                  </div>
                  {docs.length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {docs.map((doc) => (
                        <div key={doc.id} className="relative">
                          <ProtectedImage path={`/masters/me/documents/${doc.id}`} alt={kind.label} className="w-20 h-20" />
                          {editable && (
                            <button
                              type="button"
                              onClick={() => remove(doc.id)}
                              disabled={Boolean(busy)}
                              className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-ink/80 text-white flex items-center justify-center"
                              aria-label={`${kind.label}: o'chirish`}
                            >
                              {busy === doc.id ? <Spinner className="w-3.5 h-3.5 text-white" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="hint">Hujjatlarni faqat administrator ko'radi, joylashuv ma'lumotlari o'chiriladi. Hisobni o'chirsangiz, ular ham o'chadi.</p>

          {editable && (
            <button
              type="button"
              onClick={submit}
              disabled={Boolean(busy) || !req.has_passport || !req.has_specializations || !req.has_name}
              className="btn btn-primary w-full min-h-12 font-bold"
            >
              {busy === 'submit' ? <Spinner className="w-4 h-4 text-white" /> : 'Tekshiruvga yuborish'}
            </button>
          )}
        </>
      )}
    </section>
  );
}
