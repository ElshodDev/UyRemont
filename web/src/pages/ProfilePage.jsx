import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Phone, Wrench, Repeat, ShieldCheck } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner from '../components/Spinner';
import { api } from '../lib/api';
import { formatDate, formatPhone, ROLE_LABELS } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(user.name || '');
  const [saving, setSaving] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const saveName = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api('/auth/me', { method: 'PUT', body: { name } });
      setUser(data);
      toast.success('Ma\'lumotlar saqlandi');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const switchToClient = async () => {
    setSwitching(true);
    try {
      const { data } = await api('/auth/set-role', { method: 'PUT', body: { role: 'client' } });
      setUser(data);
      toast.success('Mijoz rejimiga o\'tdingiz. Usta profilingiz saqlanib qoladi');
      setSwitchOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full flex-1 space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-2xl font-black">
            {(user.name || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">{user.name || 'Ism kiritilmagan'}</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {formatPhone(user.phone)}</p>
            <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
              {user.role === 'admin' && <ShieldCheck className="w-3 h-3" />}
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </div>

        <form onSubmit={saveName} className="space-y-3">
          <label className="text-xs font-semibold text-slate-700 block">Ism va familiya</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                required
                minLength={2}
                maxLength={100}
                className="w-full p-2.5 pl-9 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={saving || name.trim() === (user.name || '')}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {saving ? <Spinner className="w-4 h-4 text-white" /> : 'Saqlash'}
            </button>
          </div>
          <p className="text-[11px] text-slate-400">Ro'yxatdan o'tgan sana: {formatDate(user.created_at, false)}</p>
        </form>
      </div>

      {user.role === 'client' && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Wrench className="w-6 h-6 flex-shrink-0" />
            <div>
              <h3 className="font-bold">
                {user.master_profile_id ? 'Usta rejimiga qaytish' : 'Usta bo\'lib ishlang'}
              </h3>
              <p className="text-xs text-white/80">
                {user.master_profile_id
                  ? 'Usta profilingiz saqlangan. Qaytadan buyurtmalar qabul qilishingiz mumkin.'
                  : 'Profil yarating va buyurtmalar qabul qiling.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/master/setup')}
            className="px-4 py-2.5 rounded-xl bg-white text-blue-700 text-sm font-bold hover:bg-blue-50 whitespace-nowrap"
          >
            {user.master_profile_id ? 'Usta rejimiga o\'tish' : 'Usta profilini yaratish'}
          </button>
        </div>
      )}

      {user.role === 'master' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-3">
          <h3 className="font-bold text-slate-900">Usta hisobi</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              to="/master/profile"
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 inline-flex items-center justify-center gap-2"
            >
              <Wrench className="w-4 h-4" /> Usta profilini tahrirlash
            </Link>
            <button
              onClick={() => setSwitchOpen(true)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 inline-flex items-center justify-center gap-2"
            >
              <Repeat className="w-4 h-4" /> Mijoz rejimiga o'tish
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Mijoz rejimida boshqa ustalarga buyurtma bera olasiz, lekin katalogda ko'rinmaysiz.
          </p>
        </div>
      )}

      {switchOpen && (
        <ConfirmDialog
          title="Mijoz rejimiga o'tasizmi?"
          description="Profilingiz katalogdan yashiriladi va yangi buyurtmalar kelmaydi. Istalgan vaqtda qaytishingiz mumkin."
          confirmLabel="O'tish"
          tone="primary"
          loading={switching}
          onConfirm={switchToClient}
          onClose={() => setSwitchOpen(false)}
        />
      )}
    </main>
  );
}
