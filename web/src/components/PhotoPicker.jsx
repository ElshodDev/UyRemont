import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle } from 'lucide-react';
import Spinner from './Spinner';
import { api } from '../lib/api';
import { downscaleImage } from '../lib/images';
import { useToast } from '../context/ToastContext';

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Muammo rasmlari: tanlangan zahoti yuklanadi, ota komponentga tayyor rasm ID lari beriladi.
 * @param {{ max?: number, onChange: (ids: string[]) => void, onBusyChange?: (busy: boolean) => void }} props
 */
export default function PhotoPicker({ max = 3, onChange, onBusyChange }) {
  const toast = useToast();
  const [items, setItems] = useState([]); // { key, preview, id?, status: 'uploading' | 'done' | 'error' }
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    onChange(items.filter((i) => i.status === 'done').map((i) => i.id));
    onBusyChange?.(items.some((i) => i.status === 'uploading'));
  }, [items]);

  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  const patch = (key, values) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...values } : i)));

  const uploadOne = async (file) => {
    const key = `${Date.now()}-${Math.random()}`;
    const preview = URL.createObjectURL(file);
    setItems((list) => [...list, { key, preview, status: 'uploading' }]);
    try {
      const blob = await downscaleImage(file);
      if (blob.size > MAX_BYTES) throw new Error('Rasm hajmi 8 MB dan oshmasligi kerak');
      const form = new FormData();
      form.append('image', blob, 'photo.jpg');
      const { data } = await api('/orders/photos', { method: 'POST', body: form });
      patch(key, { id: data.id, status: 'done' });
    } catch (error) {
      patch(key, { status: 'error' });
      toast.error(error.message);
    }
  };

  const onSelect = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const free = max - items.length;
    if (files.length > free) toast.info(`Ko'pi bilan ${max} ta rasm qo'shish mumkin`);
    files.slice(0, Math.max(0, free)).forEach(uploadOne);
  };

  const remove = (item) => {
    setItems((list) => list.filter((i) => i.key !== item.key));
    URL.revokeObjectURL(item.preview);
    // Serverdagi qoralama ham o'chiriladi (bo'lmasa 24 soatda o'zi tozalanadi)
    if (item.id) api(`/orders/photos/${item.id}`, { method: 'DELETE' }).catch(() => {});
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item, index) => (
          <div key={item.key} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
            <img src={item.preview} alt={`Muammo rasmi ${index + 1}`} className="w-full h-full object-cover" />
            {item.status === 'uploading' && (
              <div className="absolute inset-0 bg-ink/40 flex items-center justify-center">
                <Spinner className="w-6 h-6 text-white" />
              </div>
            )}
            {item.status === 'error' && (
              <div className="absolute inset-0 bg-red-600/60 flex flex-col items-center justify-center text-white text-[11px] font-bold gap-1">
                <AlertCircle className="w-5 h-5" /> Yuklanmadi
              </div>
            )}
            <button
              type="button"
              onClick={() => remove(item)}
              className="absolute top-1 right-1 w-9 h-9 rounded-full bg-ink/70 text-white flex items-center justify-center hover:bg-ink"
              aria-label={`${index + 1}-rasmni olib tashlash`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        {items.length < max && (
          <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-blue-400 text-slate-500 flex flex-col items-center justify-center gap-1 cursor-pointer transition focus-within:ring-2 focus-within:ring-blue-500">
            <Camera className="w-6 h-6" />
            <span className="text-[11px] font-semibold text-center leading-tight px-1">Rasm qo'shish</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              multiple
              className="sr-only"
              onChange={onSelect}
            />
          </label>
        )}
      </div>
      <p className="hint mt-2">
        Ko'pi bilan {max} ta. Rasmni faqat siz va buyurtmani oladigan usta ko'radi, joylashuv ma'lumotlari o'chiriladi.
      </p>
    </div>
  );
}
