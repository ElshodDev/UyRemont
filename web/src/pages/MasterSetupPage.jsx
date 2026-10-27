import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, ImagePlus, Trash2, ShieldCheck, Star } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner from '../components/Spinner';
import { api, assetUrl } from '../lib/api';
import { useSpecializations } from '../lib/useSpecializations';
import { formatRating } from '../lib/format';
import { mainVerticals, districtsList } from '../data/catalog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const inputClass = 'w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm';

function PortfolioManager() {
  const toast = useToast();
  const fileRef = useRef(null);
  const [items, setItems] = useState(null);
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [confirmItem, setConfirmItem] = useState(null);

  useEffect(() => {
    api('/masters/portfolio/my')
      .then(({ data }) => setItems(data))
      .catch((err) => {
        setItems([]);
        toast.error(err.message);
      });
  }, [toast]);

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Rasm hajmi 5 MB dan oshmasligi kerak');
      return;
    }
    const body = new FormData();
    body.append('image', file);
    body.append('description', description);
    setUploading(true);
    try {
      const { data } = await api('/masters/portfolio', { method: 'POST', body });
      setItems((list) => [data, ...list]);
      setFile(null);
      setDescription('');
      if (fileRef.current) fileRef.current.value = '';
      toast.success('Rasm qo\'shildi');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    const item = confirmItem;
    setDeleting(item.id);
    try {
      await api(`/masters/portfolio/${item.id}`, { method: 'DELETE' });
      setItems((list) => list.filter((i) => i.id !== item.id));
      toast.success('Rasm o\'chirildi');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
      setConfirmItem(null);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
      <h2 className="font-bold text-slate-900 mb-1">Portfolio</h2>
      <p className="text-xs text-slate-500 mb-4">Bajargan ishlaringiz rasmlari mijozlar ishonchini oshiradi (JPG, PNG, WEBP, 5 MB gacha).</p>

      <form onSubmit={upload} className="flex flex-col sm:flex-row gap-2 mb-5">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-xs file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold"
        />
        <input
          className={`${inputClass} flex-1`}
          placeholder="Qisqa tavsif (ixtiyoriy)"
          maxLength={300}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          type="submit"
          disabled={!file || uploading}
          className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {uploading ? <Spinner className="w-4 h-4 text-white" /> : <><ImagePlus className="w-4 h-4" /> Yuklash</>}
        </button>
      </form>

      {items === null ? (
        <Spinner label="Yuklanmoqda..." />
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl text-center">Hali rasmlar qo'shilmagan.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((item) => (
            <div key={item.id} className="relative group">
              <img src={assetUrl(item.image_url)} alt={item.description || 'portfolio'} className="h-32 w-full object-cover rounded-xl border border-slate-200" />
              {item.description && <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{item.description}</p>}
              <button
                onClick={() => setConfirmItem(item)}
                disabled={deleting === item.id}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 text-red-600 hover:bg-white shadow-sm"
                aria-label="O'chirish"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {confirmItem && (
        <ConfirmDialog
          title="Rasmni o'chirasizmi?"
          confirmLabel="O'chirish"
          loading={Boolean(deleting)}
          onConfirm={remove}
          onClose={() => setConfirmItem(null)}
        />
      )}
    </section>
  );
}

export default function MasterSetupPage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { specializations } = useSpecializations();
  const isMaster = user.role === 'master';

  const [form, setForm] = useState({
    name: user.name || '',
    bio: user.bio || '',
    experience_years: user.experience_years ?? 1,
    hourly_rate: user.hourly_rate ? Math.round(Number(user.hourly_rate)) : 80000,
    district: user.district || 'Chilonzor',
    is_available: user.is_available ?? true,
    specialization_ids: user.specialization_ids || []
  });
  const [vertical, setVertical] = useState('home');
  const [saving, setSaving] = useState(false);

  // Tanlangan mutaxassislik bo'lgan bo'limni birinchi ochish
  useEffect(() => {
    const first = specializations.find((s) => form.specialization_ids.includes(s.id));
    if (first) setVertical(first.vertical);
    // faqat katalog yuklanganda
  }, [specializations]);

  const verticalSpecs = useMemo(
    () => specializations.filter((s) => s.vertical === vertical),
    [specializations, vertical]
  );

  const toggleSpec = (id) => {
    setForm((f) => ({
      ...f,
      specialization_ids: f.specialization_ids.includes(id)
        ? f.specialization_ids.filter((x) => x !== id)
        : [...f.specialization_ids, id].slice(0, 10)
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.specialization_ids.length === 0) {
      toast.error('Kamida bitta mutaxassislikni tanlang');
      return;
    }
    setSaving(true);
    try {
      if (!isMaster) {
        await api('/auth/set-role', { method: 'PUT', body: { role: 'master' } });
      }
      await api('/masters/profile', {
        method: 'PUT',
        body: {
          ...form,
          experience_years: Number(form.experience_years),
          hourly_rate: Number(form.hourly_rate)
        }
      });
      await refresh();
      toast.success(isMaster ? 'Profil yangilandi' : 'Xush kelibsiz! Profilingiz katalogga qo\'shildi');
      if (!isMaster) navigate('/master/profile', { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (user.role === 'admin') {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 w-full flex-1 text-center text-sm text-slate-500">
        Administrator hisobi usta profiliga ega bo'la olmaydi.
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full flex-1 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600"><Wrench className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              {isMaster ? 'Usta profilim' : 'Usta sifatida qo\'shilish'}
            </h1>
            <p className="text-xs text-slate-500">
              {isMaster ? 'Ma\'lumotlaringiz katalogda shunday ko\'rinadi' : 'Qaysi sohada xizmat ko\'rsatishingizni tanlang va profil yarating'}
            </p>
          </div>
        </div>
        {isMaster && (
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-bold">
              <Star className="w-3.5 h-3.5 fill-current" /> {formatRating(user.rating)} ({user.reviews_count || 0})
            </span>
            {user.is_verified ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" /> Tasdiqlangan
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 font-semibold">Tasdiqlanmagan</span>
            )}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4 text-xs">
        <div>
          <label className="font-semibold text-slate-700 block mb-1.5">Xizmat sohasi va mutaxassislik *</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {mainVerticals.map((v) => {
              const selectedInVertical = specializations.filter((s) => s.vertical === v.id && form.specialization_ids.includes(s.id)).length;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVertical(v.id)}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 transition ${
                    vertical === v.id ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="text-base">{v.icon}</span>
                  <span className="text-xs truncate flex-1">{v.name}</span>
                  {selectedInVertical > 0 && (
                    <span className="text-[10px] bg-blue-600 text-white rounded-full px-1.5">{selectedInVertical}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {verticalSpecs.map((s) => {
              const selected = form.specialization_ids.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSpec(s.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                    selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {s.icon} {s.name_uz}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Ism va familiyangiz *</label>
            <input
              required
              minLength={2}
              maxLength={100}
              className={inputClass}
              placeholder="Masalan: Davronbek Aliyev"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Tuman *</label>
            <select className={inputClass} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}>
              {districtsList.slice(1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Tajriba (yil) *</label>
            <input
              type="number"
              required
              min="0"
              max="60"
              className={inputClass}
              value={form.experience_years}
              onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Boshlang'ich narx (so'm) *</label>
            <input
              type="number"
              required
              min="0"
              step="5000"
              className={inputClass}
              value={form.hourly_rate}
              onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">Qisqacha ma'lumot</label>
          <textarea
            rows="3"
            maxLength={1000}
            className={inputClass}
            placeholder="Ish tajribangiz, kafolatlaringiz haqida..."
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </div>

        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 accent-blue-600"
            checked={form.is_available}
            onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
          />
          <span>
            <span className="font-bold text-slate-800 block">Hozir buyurtma qabul qilaman</span>
            <span className="text-slate-500">O'chirsangiz, katalogda "Band" deb ko'rinasiz.</span>
          </span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-md shadow-blue-500/20 transition disabled:opacity-70 inline-flex items-center justify-center gap-2"
        >
          {saving ? <Spinner className="w-4 h-4 text-white" /> : isMaster ? 'O\'zgarishlarni saqlash' : 'Profilni saqlash'}
        </button>
      </form>

      {isMaster && <PortfolioManager />}
    </main>
  );
}
