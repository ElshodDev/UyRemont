import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, LogOut, Trash2, KeyRound, Copy } from 'lucide-react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import Spinner from './Spinner';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const codeInputClass = 'w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-center tracking-[0.4em] font-mono font-bold';

function TwoFactorSetup({ onClose, onEnabled }) {
  const toast = useToast();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    api('/auth/2fa/setup', { method: 'POST' })
      .then(({ data }) => setSetup(data))
      .catch((err) => setError(err.message));
  }, []);

  const enable = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api('/auth/2fa/enable', { method: 'POST', body: { code } });
      toast.success('Ikki bosqichli kirish yoqildi');
      onEnabled(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <h3 className="text-lg font-bold text-slate-900 mb-1">Ikki bosqichli kirishni yoqish</h3>
      <ol className="text-xs text-slate-600 space-y-1 mb-4 list-decimal pl-4">
        <li>Telefoningizga <strong>Google Authenticator</strong> yoki <strong>Microsoft Authenticator</strong> ilovasini o'rnating.</li>
        <li>Ilovada «+» → «QR kodni skanerlash» ni tanlang.</li>
        <li>Ilova ko'rsatgan 6 xonali kodni pastga yozing.</li>
      </ol>
      {error && <p className="mb-3 p-2.5 rounded-xl bg-red-50 text-red-700 text-xs">{error}</p>}
      {!setup && !error && <div className="py-10 flex justify-center"><Spinner className="w-6 h-6" /></div>}
      {setup && (
        <form onSubmit={enable} className="space-y-3">
          <img src={setup.qr} alt="2FA QR kod" className="w-48 h-48 mx-auto rounded-xl border border-slate-200" />
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(setup.secret).then(() => toast.success('Kalit nusxalandi'))}
            className="w-full text-[11px] font-mono text-slate-500 bg-slate-50 rounded-lg p-2 break-all inline-flex items-center justify-center gap-1.5 hover:bg-slate-100"
            title="Skanerlab bo'lmasa, kalitni qo'lda kiriting"
          >
            <Copy className="w-3 h-3 flex-shrink-0" /> {setup.secret}
          </button>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            placeholder="••••••"
            className={codeInputClass}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-60 inline-flex items-center justify-center"
          >
            {loading ? <Spinner className="w-4 h-4 text-white" /> : 'Tasdiqlash va yoqish'}
          </button>
        </form>
      )}
    </Modal>
  );
}

function TwoFactorDisable({ onClose, onDisabled }) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const disable = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api('/auth/2fa/disable', { method: 'POST', body: { code } });
      toast.success('Ikki bosqichli kirish o\'chirildi');
      onDisabled(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <h3 className="text-lg font-bold text-slate-900 mb-1">2FA ni o'chirish</h3>
      <p className="text-xs text-slate-500 mb-3">Tasdiqlash uchun authenticator ilovasidagi joriy kodni kiriting.</p>
      {error && <p className="mb-3 p-2.5 rounded-xl bg-red-50 text-red-700 text-xs">{error}</p>}
      <form onSubmit={disable} className="space-y-3">
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          maxLength={6}
          placeholder="••••••"
          className={codeInputClass}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-60 inline-flex items-center justify-center"
        >
          {loading ? <Spinner className="w-4 h-4 text-white" /> : 'O\'chirish'}
        </button>
      </form>
    </Modal>
  );
}

function DeleteAccountDialog({ onClose, onDeleted }) {
  const [understood, setUnderstood] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api('/auth/me', { method: 'DELETE', body: { confirm: true } });
      onDeleted(response.message);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Modal onClose={loading ? () => {} : onClose} size="sm">
      <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-3">
        <Trash2 className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">Hisobni o'chirasizmi?</h3>
      <ul className="text-xs text-slate-600 space-y-1.5 mb-4 list-disc pl-4">
        <li>Ismingiz, telefon raqamingiz, usta profilingiz, portfolio rasmlari va yozgan xabarlaringiz o'chiriladi.</li>
        <li>Bajarilgan buyurtmalar ikkinchi tomon tarixi uchun <strong>ismsiz</strong> holda qoladi.</li>
        <li>Bu amalni qaytarib bo'lmaydi. Shu raqam bilan keyinroq yangi hisob ochishingiz mumkin.</li>
      </ul>
      {error && <p className="mb-3 p-2.5 rounded-xl bg-red-50 text-red-700 text-xs">{error}</p>}
      <label className="flex items-center gap-2 text-sm text-slate-700 mb-4 cursor-pointer">
        <input type="checkbox" className="w-4 h-4 accent-red-600" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
        Tushundim, hisobimni o'chirmoqchiman
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onClose} disabled={loading} className="py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">
          Ortga
        </button>
        <button
          onClick={remove}
          disabled={!understood || loading}
          className="py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 inline-flex items-center justify-center"
        >
          {loading ? <Spinner className="w-4 h-4 text-white" /> : 'O\'chirish'}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Profil: ikki bosqichli kirish, barcha qurilmalardan chiqish va hisobni o'chirish
 */
export default function SecuritySettings() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const location = useLocation();
  const sectionRef = React.useRef(null);

  // Admin paneldan "Profil → Xavfsizlik" havolasi bilan kelganda shu bo'limga o'tish
  React.useEffect(() => {
    if (location.hash === '#xavfsizlik') sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  const logoutEverywhere = async () => {
    setLoggingOut(true);
    try {
      await api('/auth/logout-all', { method: 'POST' });
      logout();
      toast.success('Barcha qurilmalardan chiqildi');
      navigate('/');
    } catch (err) {
      toast.error(err.message);
      setLoggingOut(false);
    }
  };

  return (
    <section id="xavfsizlik" ref={sectionRef} className="scroll-mt-24 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
      <h3 className="font-bold text-slate-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-blue-600" /> Xavfsizlik</h3>

      <div className={`p-4 rounded-xl border ${user.totp_enabled ? 'bg-emerald-50 border-emerald-200' : user.role === 'admin' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            {user.totp_enabled ? <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5" /> : <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5" />}
            <div>
              <p className="text-sm font-bold text-slate-900">Ikki bosqichli kirish (2FA) {user.totp_enabled ? 'yoqilgan' : 'o\'chiq'}</p>
              <p className="text-xs text-slate-500">
                {user.totp_enabled
                  ? 'Kirishda SMS koddan tashqari authenticator ilovasidagi kod ham so\'raladi.'
                  : user.role === 'admin'
                    ? 'Administrator hisobi uchun albatta yoqing: SIM karta o\'g\'irlansa ham hisobingiz himoyalangan bo\'ladi.'
                    : 'Qo\'shimcha himoya: SIM karta o\'g\'irlansa ham hisobingizga kira olishmaydi.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setDialog(user.totp_enabled ? 'disable2fa' : 'setup2fa')}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap inline-flex items-center justify-center gap-2 ${
              user.totp_enabled ? 'border border-slate-200 text-slate-700 hover:bg-white' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <KeyRound className="w-4 h-4" /> {user.totp_enabled ? 'O\'chirish' : 'Yoqish'}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={() => setDialog('logoutAll')}
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 inline-flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" /> Barcha qurilmalardan chiqish
        </button>
        {user.role !== 'admin' && (
          <button
            onClick={() => setDialog('delete')}
            className="flex-1 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 inline-flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Hisobni o'chirish
          </button>
        )}
      </div>

      {dialog === 'setup2fa' && (
        <TwoFactorSetup onClose={() => setDialog(null)} onEnabled={(data) => { setUser(data); setDialog(null); }} />
      )}
      {dialog === 'disable2fa' && (
        <TwoFactorDisable onClose={() => setDialog(null)} onDisabled={(data) => { setUser(data); setDialog(null); }} />
      )}
      {dialog === 'logoutAll' && (
        <ConfirmDialog
          title="Barcha qurilmalardan chiqasizmi?"
          description="Shu va boshqa barcha telefon/kompyuterlardagi sessiyalar yopiladi. Qayta kirish uchun SMS kod kerak bo'ladi."
          confirmLabel="Chiqish"
          tone="primary"
          loading={loggingOut}
          onConfirm={logoutEverywhere}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'delete' && (
        <DeleteAccountDialog
          onClose={() => setDialog(null)}
          onDeleted={(message) => {
            logout();
            toast.success(message);
            navigate('/');
          }}
        />
      )}
    </section>
  );
}
