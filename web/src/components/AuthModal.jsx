import React, { useEffect, useState } from 'react';
import { Phone, ShieldCheck, User, ArrowLeft, KeyRound, Send, MessageSquare } from 'lucide-react';
import Modal from './Modal';
import Spinner from './Spinner';
import { api } from '../lib/api';
import { formatPhone } from '../lib/format';
import { TELEGRAM_BUTTON, useLoginMethods, usePolling } from '../lib/telegram';

// Telegram bot havolasi holati (sayt kutish ekrani uchun)
const TELEGRAM_STATUS = {
  pending: { text: 'Telegram\'da botni oching va «Start» ni bosing', tone: 'text-slate-600' },
  waiting_contact: { text: 'Botda «📱 Raqamni yuborish» tugmasini bosing', tone: 'text-slate-600' },
  sent: { text: '✅ Kod Telegram\'ga yuborildi. Uni pastga kiriting', tone: 'text-emerald-700' },
  mismatch: { text: 'Telegram\'dagi raqamingiz boshqa. To\'g\'ri raqamni kiriting yoki SMS orqali kiring', tone: 'text-red-600' },
  expired: { text: 'Havola eskirdi. «Qayta yuborish» ni bosing', tone: 'text-amber-700' }
};

const inputClass = 'input min-h-12';

/**
 * Telefon raqam + kod orqali kirish (3 bosqich: raqam -> kod -> ism).
 * Kod Telegram bot yoki SMS orqali keladi; tasdiqlash ikkalasida bir xil (/auth/verify-otp).
 */
export default function AuthModal({ onClose, onSuccess }) {
  const methods = useLoginMethods();
  const [step, setStep] = useState('phone');
  const [channel, setChannel] = useState('sms');
  const [tgRequest, setTgRequest] = useState(null);
  const [tgStatus, setTgStatus] = useState('pending');
  const [nameHint, setNameHint] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [totpCode, setTotpCode] = useState('');

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const sendCode = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading('sms');
    try {
      const { data } = await api('/auth/send-otp', { method: 'POST', body: { phone } });
      setNormalizedPhone(data.phone);
      setDevCode(data.devCode || null);
      setChannel('sms');
      setTgRequest(null);
      setCode('');
      setStep('code');
      setResendIn(60);
    } catch (err) {
      if (err.data?.retryAfter) {
        setResendIn(err.data.retryAfter);
        if (normalizedPhone) setStep('code');
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Kodni Telegram orqali olish: raqam ulangan bo'lsa kod darhol keladi, aks holda botga havola
  const sendTelegram = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading('telegram');
    try {
      const { data } = await api('/auth/telegram/start', { method: 'POST', body: { phone } });
      setNormalizedPhone(data.phone);
      setChannel('telegram');
      setDevCode(null);
      setCode('');
      if (data.status === 'sent') {
        setTgRequest(null);
        setResendIn(60);
      } else {
        setTgRequest(data);
        setTgStatus('pending');
        setResendIn(0);
      }
      setStep('code');
    } catch (err) {
      if (err.data?.retryAfter) {
        setResendIn(err.data.retryAfter);
        if (normalizedPhone) setStep('code');
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  usePolling(async () => {
    const { data } = await api(`/auth/telegram/requests/${tgRequest.request}`);
    setTgStatus(data.status);
    if (data.name_hint) setNameHint(data.name_hint);
    if (data.status === 'sent') setResendIn(60);
    return ['sent', 'mismatch', 'expired'].includes(data.status);
  }, 2000, step === 'code' && channel === 'telegram' && Boolean(tgRequest));

  const verifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api('/auth/verify-otp', {
        method: 'POST',
        body: { phone: normalizedPhone, code, accept_terms: acceptTerms }
      });
      if (data.requires_2fa) {
        // Ikki bosqichli kirish: authenticator ilovasidagi kod
        setChallenge(data.challenge_token);
        setStep('totp');
      } else if (!data.user.name) {
        // Yangi foydalanuvchidan ism so'raladi (Telegram'dagi ism bilan oldindan to'ldiriladi)
        setSession(data);
        setName(nameHint);
        setStep('name');
      } else {
        onSuccess(data.token, data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyTotp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api('/auth/2fa/verify', {
        method: 'POST',
        body: { challenge_token: challenge, code: totpCode }
      });
      onSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message);
      if (err.status === 401 || err.status === 429) {
        setStep('phone');
        setChallenge(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveName = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Token hali saqlanmagan, shuning uchun so'rovga alohida beriladi
      const { data } = await api('/auth/me', { method: 'PUT', body: { name }, token: session.token });
      onSuccess(session.token, data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-md shadow-blue-500/20">
          🛠️
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            {step === 'name' ? 'Tanishib olaylik' : step === 'totp' ? 'Ikki bosqichli kirish' : 'Tizimga kirish'}
          </h3>
          <p className="text-xs text-slate-500">
            {step === 'phone' && (methods?.enabled ? 'Kirish kodi Telegram yoki SMS orqali keladi' : 'Telefon raqamingizga SMS kod yuboramiz')}
            {step === 'code' && channel === 'sms' && `${formatPhone(normalizedPhone)} raqamiga kod yuborildi`}
            {step === 'code' && channel === 'telegram' && (tgRequest && tgStatus !== 'sent'
              ? `${formatPhone(normalizedPhone)} — Telegram orqali tasdiqlang`
              : `${formatPhone(normalizedPhone)} — kod Telegram'ga yuborildi`)}
            {step === 'name' && 'Ustalar sizni qanday chaqirsin?'}
            {step === 'totp' && 'Authenticator ilovasidagi 6 xonali kodni kiriting'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          {error}
        </div>
      )}

      {step === 'phone' && (
        <form onSubmit={methods?.enabled ? sendTelegram : sendCode} className="space-y-3">
          <label className="text-xs font-semibold text-slate-700 block">Telefon raqam</label>
          <div className="relative">
            <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="tel"
              autoFocus
              required
              className={`${inputClass} pl-9`}
              placeholder="+998 90 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              required
              className="mt-0.5 w-4 h-4 accent-blue-600 flex-shrink-0"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
            />
            <span>
              <a href="/terms" target="_blank" rel="noreferrer" className="text-blue-600 font-semibold hover:underline">Foydalanish shartlari</a>
              {' '}va{' '}
              <a href="/privacy" target="_blank" rel="noreferrer" className="text-blue-600 font-semibold hover:underline">Maxfiylik siyosati</a>
              ga roziman, shaxsiy ma'lumotlarimni qayta ishlashga rozilik beraman
            </span>
          </label>
          {methods?.enabled ? (
            <>
              <button type="submit" disabled={Boolean(loading) || !acceptTerms} className={TELEGRAM_BUTTON}>
                {loading === 'telegram' ? <Spinner className="w-4 h-4 text-white" /> : <><Send className="w-4 h-4" /> Telegram orqali kod olish</>}
              </button>
              {methods.sms_enabled && (
                <button type="button" onClick={sendCode} disabled={Boolean(loading) || !acceptTerms} className="btn btn-secondary w-full min-h-12">
                  {loading === 'sms' ? <Spinner className="w-4 h-4" /> : <><MessageSquare className="w-4 h-4" /> SMS orqali kod olish</>}
                </button>
              )}
              <p className="hint text-center">Telegram orqali — tez va bepul. Kod «Usta24» botidan keladi.</p>
            </>
          ) : (
            <button
              type="submit"
              disabled={Boolean(loading) || !acceptTerms}
              className="btn btn-primary w-full font-bold shadow-md shadow-blue-500/20 min-h-12"
            >
              {loading ? <Spinner className="w-4 h-4 text-white" /> : 'Kod olish'}
            </button>
          )}
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={verifyCode} className="space-y-3">
          {devCode && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              Development rejimi: SMS sozlanmagan. Kod: <strong className="font-mono text-sm">{devCode}</strong>
            </div>
          )}
          {channel === 'telegram' && tgRequest && (
            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-3">
              <ol className="text-xs text-slate-700 space-y-1 list-decimal pl-4">
                <li>«Telegram'ni ochish» tugmasini bosing</li>
                <li>Botda <strong>Start</strong> ni bosing</li>
                <li><strong>📱 Raqamni yuborish</strong> ni bosing — kod Telegram'ga keladi</li>
              </ol>
              <a href={tgRequest.bot_url} target="_blank" rel="noreferrer" className={TELEGRAM_BUTTON}>
                <Send className="w-4 h-4" /> Telegram'ni ochish
              </a>
              <p className={`text-xs font-semibold ${TELEGRAM_STATUS[tgStatus]?.tone || 'text-slate-600'}`} role="status" aria-live="polite">
                {TELEGRAM_STATUS[tgStatus]?.text}
              </p>
            </div>
          )}
          <label className="text-xs font-semibold text-slate-700 block">6 xonali kod</label>
          <div className="relative">
            <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={6}
              className={`${inputClass} pl-9 tracking-[0.4em] font-mono font-bold`}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="btn btn-primary w-full font-bold shadow-md shadow-blue-500/20 min-h-12"
          >
            {loading ? <Spinner className="w-4 h-4 text-white" /> : 'Tasdiqlash'}
          </button>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => { setStep('phone'); setError(''); setTgRequest(null); }}
              className="inline-flex items-center gap-1 min-h-11 text-slate-500 hover:text-slate-800 font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Raqamni o'zgartirish
            </button>
            <button
              type="button"
              disabled={resendIn > 0 || Boolean(loading)}
              onClick={channel === 'telegram' ? sendTelegram : sendCode}
              className="min-h-11 text-blue-600 font-semibold disabled:text-slate-400"
            >
              {resendIn > 0 ? `Qayta yuborish (${resendIn})` : 'Qayta yuborish'}
            </button>
          </div>
          {channel === 'telegram' && methods?.sms_enabled && (
            <button type="button" onClick={sendCode} disabled={Boolean(loading)} className="btn btn-ghost w-full text-xs">
              <MessageSquare className="w-4 h-4" /> Kodni SMS orqali olish
            </button>
          )}
        </form>
      )}

      {step === 'totp' && (
        <form onSubmit={verifyTotp} className="space-y-3">
          <label className="text-xs font-semibold text-slate-700 block">Authenticator kodi</label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={6}
              className={`${inputClass} pl-9 tracking-[0.4em] font-mono font-bold`}
              placeholder="••••••"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <button
            type="submit"
            disabled={loading || totpCode.length !== 6}
            className="btn btn-primary w-full font-bold shadow-md shadow-blue-500/20 min-h-12"
          >
            {loading ? <Spinner className="w-4 h-4 text-white" /> : 'Kirish'}
          </button>
          <p className="text-[11px] text-slate-400">Telefoningizni yo'qotgan bo'lsangiz, administrator bilan bog'laning.</p>
        </form>
      )}

      {step === 'name' && (
        <form onSubmit={saveName} className="space-y-3">
          <label className="text-xs font-semibold text-slate-700 block">Ism va familiya</label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              required
              minLength={2}
              maxLength={100}
              className={`${inputClass} pl-9`}
              placeholder="Masalan: Aziz Karimov"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading || name.trim().length < 2}
            className="btn btn-primary w-full font-bold shadow-md shadow-blue-500/20 min-h-12"
          >
            {loading ? <Spinner className="w-4 h-4 text-white" /> : 'Davom etish'}
          </button>
        </form>
      )}
    </Modal>
  );
}
