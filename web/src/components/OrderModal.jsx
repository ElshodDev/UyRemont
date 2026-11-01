import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Send } from 'lucide-react';
import Modal from './Modal';
import Spinner from './Spinner';
import PhotoPicker from './PhotoPicker';
import SavedAddressChips from './SavedAddressChips';
import { useSavedAddresses } from '../lib/useSavedAddresses';
import { specializationLabel } from './MasterCard';
import { api } from '../lib/api';
import { districtsList } from '../data/catalog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatPhone } from '../lib/format';
import { t, specName } from '../i18n';

const inputClass = 'input';

// Tarjima matnidagi {name} o'rniga React element (so'z tartibi tilga qarab o'zgaradi)
const withElement = (template, element) => {
  const [before, after = ''] = template.split('{name}');
  return <>{before}{element}{after}</>;
};

/**
 * Buyurtma berish: master berilsa shu ustaga, aks holda tanlangan sohadagi barcha ustalarga ochiq.
 * initial - "Yana buyurtma berish" uchun oldingi buyurtma maydonlari
 */
export default function OrderModal({ master, specializations = [], defaultSpecializationId, initial, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const { addresses } = useSavedAddresses();
  const [savedId, setSavedId] = useState(null);
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    address: initial?.address || '',
    district: initial?.district || master?.district || '',
    budget: '',
    scheduled_at: '',
    specialization_id: initial?.specialization_id || defaultSpecializationId || master?.specializations?.[0]?.id || ''
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

  const update = (field) => (e) => {
    if (field === 'address' || field === 'district') setSavedId(null);
    setForm({ ...form, [field]: e.target.value });
  };

  const pickAddress = (address) => {
    setSavedId(address.id);
    setForm((f) => ({ ...f, address: address.address, district: address.district || f.district }));
  };

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
      toast.success(t('Buyurtma yuborildi'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Telegramga xabar formatini tayyorlash
  const telegramShareUrl = () => {
    const lines = [
      t('🏠 Yangi Buyurtma (Usta24 Platformasi):'),
      '',
      t('👤 Mijoz: {name}', { name: user?.name || '' }),
      t('📞 Telefon: {phone}', { phone: formatPhone(user?.phone) }),
      t('📍 Manzil: {address}', { address: created.address }),
      master ? t('🛠️ Usta: {name} ({spec})', { name: master.name, spec: specializationLabel(master) }) : null,
      t('📝 Ish: {text}', { text: `${created.title}${created.description ? ` — ${created.description}` : ''}` })
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
          <h3 id="order-modal-title" className="text-xl font-bold text-slate-900 mb-1">{t('Buyurtma qabul qilindi!')}</h3>
          <p className="text-xs text-slate-500 mb-6">
            {master
              ? withElement(t('Usta {name} buyurtmani qabul qilgach, uning holati va chat shu yerda ko\'rinadi.'), <strong>{master.name}</strong>)
              : t('Buyurtmangiz mos ustalarga ko\'rsatildi. Birinchi qabul qilgan usta siz bilan bog\'lanadi.')}
          </p>

          {master && (
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl mb-4 text-left">
              <span className="text-xs text-sky-800 font-bold block mb-1">{t('Tezkor tasdiqlash:')}</span>
              <p className="text-[11px] text-sky-700 mb-3">
                {t('Buyurtmani Telegram orqali ham ustaga yuborib, tezroq kelishishingiz mumkin.')}
              </p>
              <a
                href={telegramShareUrl()}
                target="_blank"
                rel="noreferrer"
                className="btn w-full bg-sky-500 text-white font-bold hover:bg-sky-600"
              >
                <Send className="w-4 h-4" />
                {t('Telegram orqali yuborish')}
              </a>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onClose}
              className="btn btn-secondary w-full"
            >
              {t('Yopish')}
            </button>
            <Link
              to={`/orders/${created.id}`}
              onClick={onClose}
              className="btn btn-primary w-full font-bold"
            >
              {t('Buyurtmani ko\'rish')}
            </Link>
          </div>
        </div>
      ) : (
        <div>
          <h3 id="order-modal-title" className="text-lg font-bold text-slate-900 mb-1 pr-10">
            {master ? t('Buyurtma berish') : t('Ochiq buyurtma qoldirish')}
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            {master
              ? <>{t('Usta:')} <strong className="text-blue-600">{master.name}</strong> ({specializationLabel(master)})</>
              : t('Usta tanlamasdan ish tavsifini qoldiring — mos ustalar o\'zlari taklif bilan chiqadi.')}
          </p>

          {error && (
            <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {specOptions.length > 0 && (
              <div>
                <label className="label" htmlFor="order-field-1">{t('Xizmat turi')} {master ? '' : '*'}</label>
                <select
                  id="order-field-1"
                  className={inputClass}
                  required={!master}
                  value={form.specialization_id}
                  onChange={update('specialization_id')}
                >
                  {!master && <option value="">{t('Tanlang...')}</option>}
                  {specOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.icon} {specName(s)}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="label" htmlFor="order-field-2">{t('Nima qilish kerak? *')}</label>
              <input
                id="order-field-2"
                required
                minLength={3}
                maxLength={200}
                placeholder={t('Masalan: Oshxonadagi kran oqyapti')}
                className={inputClass}
                value={form.title}
                onChange={update('title')}
              />
            </div>

            <div>
              <label className="label" htmlFor="order-field-3">{t('Batafsil tavsif')}</label>
              <textarea
                id="order-field-3"
                rows="3"
                maxLength={2000}
                placeholder={t('Muammo, o\'lchamlar, materiallar bor-yo\'qligi...')}
                className={inputClass}
                value={form.description}
                onChange={update('description')}
              />
            </div>

            <SavedAddressChips addresses={addresses} selectedId={savedId} onSelect={pickAddress} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="order-field-4">{t('Tuman')}</label>
                <select id="order-field-4" className={inputClass} value={form.district} onChange={update('district')}>
                  <option value="">{t('Tanlang...')}</option>
                  {districtsList.slice(1).map((d) => <option key={d} value={d}>{t(d)}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="order-field-5">{t('Manzil *')}</label>
                <input
                  id="order-field-5"
                  required
                  minLength={3}
                  maxLength={500}
                  placeholder={t('9-mavze, 12-uy')}
                  className={inputClass}
                  value={form.address}
                  onChange={update('address')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="order-field-6">{t('Byudjet (so\'m)')}</label>
                <input
                  id="order-field-6"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder={t('Kelishiladi')}
                  className={inputClass}
                  value={form.budget}
                  onChange={update('budget')}
                />
              </div>
              <div>
                <label className="label" htmlFor="order-field-7">{t('Qulay vaqt')}</label>
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
              <span className="label">{t('Rasm (ixtiyoriy)')}</span>
              <PhotoPicker onChange={setPhotoIds} onBusyChange={setPhotosBusy} />
            </div>

            <p className="hint">
              {t('Aloqa uchun raqamingiz ({phone}) usta buyurtmani qabul qilgandan keyin ko\'rinadi.', { phone: formatPhone(user?.phone) })}
            </p>

            <button
              type="submit"
              disabled={submitting || photosBusy}
              className="btn btn-primary w-full min-h-12 font-bold shadow-md shadow-blue-500/20 mt-2"
            >
              {submitting ? <Spinner className="w-4 h-4 text-white" /> : t('Buyurtmani tasdiqlash')}
            </button>
          </form>
        </div>
      )}
    </Modal>
  );
}
