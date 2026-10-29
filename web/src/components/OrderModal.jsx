import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Send } from 'lucide-react';
import Modal from './Modal';
import Spinner from './Spinner';
import PhotoPicker from './PhotoPicker';
import { specializationLabel } from './MasterCard';
import { api } from '../lib/api';
import { districtsList } from '../data/catalog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatPhone } from '../lib/format';

const inputClass = 'input';

/**
 * Buyurtma berish: master berilsa shu ustaga, aks holda tanlangan sohadagi barcha ustalarga ochiq
 */
export default function OrderModal({ master, specializations = [], defaultSpecializationId, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    title: '',
    description: '',
    address: '',
    district: master?.district || '',
    budget: '',
    scheduled_at: '',
    specialization_id: defaultSpecializationId || master?.specializations?.[0]?.id || ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [photoIds, setPhotoIds] = useState([]);
  const [photosBusy, setPhotosBusy] = useState(false);

  const specOptions = useMemo(
    () => (master?.specializations?.length ? master.specializations : specializations),
    [master, specializations]
  );

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api('/orders', {
        method: 'POST',
        body: {
          ...form,
          master_id: master?.id,
          specialization_id: form.specialization_id ? Number(form.specialization_id) : undefined,
          budget: form.budget || undefined,
          photo_ids: photoIds,
          scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : undefined
        }
      });
      setCreated(data);
      toast.success('Buyurtma yuborildi');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Telegramga xabar formatini tayyorlash
  const telegramShareUrl = () => {
    const lines = [
      '🏠 Yangi Buyurtma (Usta24 Platformasi):',
      '',
      `👤 Mijoz: ${user?.name || ''}`,
      `📞 Telefon: ${formatPhone(user?.phone)}`,
      `📍 Manzil: ${created.address}`,
      master ? `🛠️ Usta: ${master.name} (${specializationLabel(master)})` : null,
      `📝 Ish: ${created.title}${created.description ? ` — ${created.description}` : ''}`
    ].filter((line) => line !== null);
    return `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(lines.join('\n'))}`;
  };

  return (
    <Modal onClose={onClose} labelledBy="order-modal-title">
      {created ? (
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8" />
          </div>
          <h3 id="order-modal-title" className="text-xl font-bold text-slate-900 mb-1">Buyurtma qabul qilindi!</h3>
          <p className="text-xs text-slate-500 mb-6">
            {master
              ? <>Usta <strong>{master.name}</strong> buyurtmani qabul qilgach, uning holati va chat shu yerda ko'rinadi.</>
              : 'Buyurtmangiz mos ustalarga ko\'rsatildi. Birinchi qabul qilgan usta siz bilan bog\'lanadi.'}
          </p>

          {master && (
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl mb-4 text-left">
              <span className="text-xs text-sky-800 font-bold block mb-1">Tezkor tasdiqlash:</span>
              <p className="text-[11px] text-sky-700 mb-3">
                Buyurtmani Telegram orqali ham ustaga yuborib, tezroq kelishishingiz mumkin.
              </p>
              <a
                href={telegramShareUrl()}
                target="_blank"
                rel="noreferrer"
                className="btn w-full bg-sky-500 text-white font-bold hover:bg-sky-600"
              >
                <Send className="w-4 h-4" />
                Telegram orqali yuborish
              </a>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onClose}
              className="btn btn-secondary w-full"
            >
              Yopish
            </button>
            <Link
              to={`/orders/${created.id}`}
              onClick={onClose}
              className="btn btn-primary w-full font-bold"
            >
              Buyurtmani ko'rish
            </Link>
          </div>
        </div>
      ) : (
        <div>
          <h3 id="order-modal-title" className="text-lg font-bold text-slate-900 mb-1 pr-10">
            {master ? 'Buyurtma berish' : 'Ochiq buyurtma qoldirish'}
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            {master
              ? <>Usta: <strong className="text-blue-600">{master.name}</strong> ({specializationLabel(master)})</>
              : 'Usta tanlamasdan ish tavsifini qoldiring — mos ustalar o\'zlari taklif bilan chiqadi.'}
          </p>

          {error && (
            <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {specOptions.length > 0 && (
              <div>
                <label className="label" htmlFor="order-field-1">Xizmat turi {master ? '' : '*'}</label>
                <select
                  id="order-field-1"
                  className={inputClass}
                  required={!master}
                  value={form.specialization_id}
                  onChange={update('specialization_id')}
                >
                  {!master && <option value="">Tanlang...</option>}
                  {specOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.icon} {s.name_uz}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="label" htmlFor="order-field-2">Nima qilish kerak? *</label>
              <input
                id="order-field-2"
                required
                minLength={3}
                maxLength={200}
                placeholder="Masalan: Oshxonadagi kran oqyapti"
                className={inputClass}
                value={form.title}
                onChange={update('title')}
              />
            </div>

            <div>
              <label className="label" htmlFor="order-field-3">Batafsil tavsif</label>
              <textarea
                id="order-field-3"
                rows="3"
                maxLength={2000}
                placeholder="Muammo, o'lchamlar, materiallar bor-yo'qligi..."
                className={inputClass}
                value={form.description}
                onChange={update('description')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="order-field-4">Tuman</label>
                <select id="order-field-4" className={inputClass} value={form.district} onChange={update('district')}>
                  <option value="">Tanlang...</option>
                  {districtsList.slice(1).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="order-field-5">Manzil *</label>
                <input
                  id="order-field-5"
                  required
                  minLength={3}
                  maxLength={500}
                  placeholder="9-mavze, 12-uy"
                  className={inputClass}
                  value={form.address}
                  onChange={update('address')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="order-field-6">Byudjet (so'm)</label>
                <input
                  id="order-field-6"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="Kelishiladi"
                  className={inputClass}
                  value={form.budget}
                  onChange={update('budget')}
                />
              </div>
              <div>
                <label className="label" htmlFor="order-field-7">Qulay vaqt</label>
                <input
                  id="order-field-7"
                  type="datetime-local"
                  className={inputClass}
                  value={form.scheduled_at}
                  onChange={update('scheduled_at')}
                />
              </div>
            </div>

            <div>
              <span className="label">Rasm (ixtiyoriy)</span>
              <PhotoPicker onChange={setPhotoIds} onBusyChange={setPhotosBusy} />
            </div>

            <p className="hint">
              Aloqa uchun raqamingiz ({formatPhone(user?.phone)}) usta buyurtmani qabul qilgandan keyin ko'rinadi.
            </p>

            <button
              type="submit"
              disabled={submitting || photosBusy}
              className="btn btn-primary w-full min-h-12 font-bold shadow-md shadow-blue-500/20 mt-2"
            >
              {submitting ? <Spinner className="w-4 h-4 text-white" /> : 'Buyurtmani tasdiqlash'}
            </button>
          </form>
        </div>
      )}
    </Modal>
  );
}
