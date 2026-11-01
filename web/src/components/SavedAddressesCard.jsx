import React, { useState } from 'react';
import { MapPin, Pencil, Trash2, Check, X } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import Spinner from './Spinner';
import { addressIcon, useSavedAddresses } from '../lib/useSavedAddresses';
import { useToast } from '../context/ToastContext';

/**
 * Profil: saqlangan manzillarni ko'rish, nomini o'zgartirish va o'chirish.
 * Yangi manzil usta chaqirishda "Bu manzilni saqlash" orqali qo'shiladi (xaritadagi joyi bilan).
 */
export default function SavedAddressesCard() {
  const toast = useToast();
  const { addresses, loaded, update, remove } = useSavedAddresses();
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ label: '', address: '' });
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const startEdit = (address) => {
    setEditing(address.id);
    setDraft({ label: address.label, address: address.address });
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await update(editing, draft);
      setEditing(null);
      toast.success('Manzil yangilandi');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await remove(toDelete.id);
      toast.success('Manzil o\'chirildi');
      setToDelete(null);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-5 sm:p-6 space-y-3" aria-labelledby="addresses-title">
      <div>
        <h3 id="addresses-title" className="font-bold text-slate-900 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" /> Saqlangan manzillar</h3>
        <p className="text-xs text-slate-500">Usta chaqirishda bir bosishda tanlanadi. Yangi manzil chaqiruv paytida «Bu manzilni saqlash» orqali qo'shiladi.</p>
      </div>

      {!loaded && <Spinner className="w-4 h-4" />}
      {loaded && addresses.length === 0 && <p className="text-sm text-slate-400">Hali saqlangan manzil yo'q.</p>}

      <ul className="divide-y divide-slate-100">
        {addresses.map((address) => (
          <li key={address.id} className="py-3">
            {editing === address.id ? (
              <form onSubmit={save} className="space-y-2">
                <input className="input" required maxLength={40} aria-label="Manzil nomi" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
                <input className="input" required minLength={3} maxLength={500} aria-label="Manzil" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
                <div className="flex gap-2">
                  <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
                    {busy ? <Spinner className="w-4 h-4 text-white" /> : <><Check className="w-4 h-4" /> Saqlash</>}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}><X className="w-4 h-4" /> Bekor</button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xl" aria-hidden="true">{addressIcon(address.label)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{address.label}</p>
                  <p className="text-xs text-slate-500 truncate">{[address.district, address.address].filter(Boolean).join(', ')}</p>
                </div>
                <button type="button" className="icon-btn" onClick={() => startEdit(address)} aria-label={`${address.label}: tahrirlash`}>
                  <Pencil className="w-4 h-4" />
                </button>
                <button type="button" className="icon-btn text-red-500 hover:text-red-600" onClick={() => setToDelete(address)} aria-label={`${address.label}: o'chirish`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {toDelete && (
        <ConfirmDialog
          title={`"${toDelete.label}" o'chirilsinmi?`}
          description={toDelete.address}
          confirmLabel="O'chirish"
          loading={busy}
          onConfirm={confirmDelete}
          onClose={() => setToDelete(null)}
        />
      )}
    </section>
  );
}
