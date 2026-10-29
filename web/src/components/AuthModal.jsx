import React, { useEffect, useState } from 'react';
import { Phone, ShieldCheck, User, ArrowLeft, KeyRound } from 'lucide-react';
import Modal from './Modal';
import Spinner from './Spinner';
import { api } from '../lib/api';
import { formatPhone } from '../lib/format';

const inputClass = 'input min-h-12';

/**
 * Telefon raqam + SMS kod orqali kirish (3 bosqich: raqam -> kod -> ism)
 */
export default function AuthModal({ onClose, onSuccess }) {
  const [step, setStep] = useState('phone');
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
    setLoading(true);
    try {
      const { data } = await api('/auth/send-otp', { method: 'POST', body: { phone } });
      setNormalizedPhone(data.phone);
      setDevCode(data.devCode || null);
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
        // Yangi foydalanuvchidan ism so'raladi
        setSession(data);
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
            {step === 'phone' && 'Telefon raqamingizga SMS kod yuboramiz'}
            {step === 'code' && `${formatPhone(normalizedPhone)} raqamiga kod yuborildi`}
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
        <form onSubmit={sendCode} className="space-y-3">
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
          <button
            type="submit"
            disabled={loading || !acceptTerms}
            className="btn btn-primary w-full font-bold shadow-md shadow-blue-500/20 min-h-12"
          >
            {loading ? <Spinner className="w-4 h-4 text-white" /> : 'Kod olish'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={verifyCode} className="space-y-3">
          {devCode && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              Development rejimi: SMS sozlanmagan. Kod: <strong className="font-mono text-sm">{devCode}</strong>
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
              onClick={() => { setStep('phone'); setError(''); }}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Raqamni o'zgartirish
            </button>
            <button
              type="button"
              disabled={resendIn > 0 || loading}
              onClick={sendCode}
              className="text-blue-600 font-semibold disabled:text-slate-400"
            >
              {resendIn > 0 ? `Qayta yuborish (${resendIn})` : 'Qayta yuborish'}
            </button>
          </div>
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
