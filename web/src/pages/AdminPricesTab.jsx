import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, Eye, EyeOff } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner, { PageLoader } from '../components/Spinner';
import { ErrorState } from '../components/EmptyState';
import TwoFactorRequired, { isTwoFactorError } from '../components/TwoFactorRequired';
import { api } from '../lib/api';
import { formatPriceRange } from '../lib/format';
import { mainVerticals } from '../data/catalog';
import { useToast } from '../context/ToastContext';

const toForm = (item) => ({
  name: item.name,
  price_min: String(item.price_min),
  price_max: item.price_max === null ? '' : String(item.price_max),
  unit: item.unit,
  is_active: item.is_active
});
const toBody = (form) => ({
  ...form,
  price_min: Number(form.price_min),
  price_max: form.price_max === '' ? null : Number(form.price_max)
});
const EMPTY = { name: '', price_min: '', price_max: '', unit: 'ish', is_active: true };

function PriceRow({ item, units, onSaved, onDelete }) {
  const toast = useToast();
  const [form, setForm] = useState(() => toForm(item));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(item));
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const save = async (next = form) => {
    setSaving(true);
    try {
      await api(`/admin/prices/${item.id}`, { method: 'PUT', body: toBody(next) });
      toast.success('Narx saqlandi');
      onSaved();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className={`p-3 grid grid-cols-2 sm:grid-cols-12 gap-2 items-center ${form.is_active ? '' : 'opacity-60'}`}>
      <input className="input col-span-2 sm:col-span-4" aria-label="Ish nomi" value={form.name} onChange={set('name')} />
      <input className="input sm:col-span-2" type="number" min="0" step="1000" aria-label="Eng kam narx" value={form.price_min} onChange={set('price_min')} />
      <input className="input sm:col-span-2" type="number" min="0" step="1000" aria-label="Eng ko'p narx" placeholder="—" value={form.price_max} onChange={set('price_max')} />
      <select className="input sm:col-span-2" aria-label="O'lchov birligi" value={form.unit} onChange={set('unit')}>
        {units.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
      <div className="flex gap-1 justify-end sm:col-span-2">
        <button
          type="button"
          className="icon-btn"
          onClick={() => save({ ...form, is_active: !form.is_active })}
          aria-label={form.is_active ? 'Mijozlardan yashirish' : 'Mijozlarga ko\'rsatish'}
          title={form.is_active ? 'Yashirish' : 'Ko\'rsatish'}
        >
          {form.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button type="button" className="icon-btn text-red-500 hover:text-red-600" onClick={() => onDelete(item)} aria-label="O'chirish">
          <Trash2 className="w-4 h-4" />
        </button>
        <button type="button" className="btn btn-primary px-3" disabled={!dirty || saving} onClick={() => save()} aria-label={`${form.name || 'Narx'}: saqlash`} title="Saqlash">
          {saving ? <Spinner className="w-4 h-4 text-white" /> : <Save className="w-4 h-4" />}
        </button>
      </div>
    </li>
  );
}

function CallFeeEditor({ group, onSaved }) {
  const toast = useToast();
  const [value, setValue] = useState(String(Math.round(group.call_fee)));
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(String(Math.round(group.call_fee))), [group.call_fee]);

  const save = async () => {
    setSaving(true);
    try {
      await api(`/admin/specializations/${group.id}/call-fee`, { method: 'PUT', body: { call_fee: Number(value) } });
      toast.success('Chiqish narxi saqlandi');
      onSaved();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-end gap-2">
      <label className="flex-1">
        <span className="label">Chiqish narxi (so'm)</span>
        <input className="input" type="number" min="0" step="1000" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <button type="button" className="btn btn-secondary" disabled={saving || Number(value) === Math.round(group.call_fee)} onClick={save}>
        {saving ? <Spinner className="w-4 h-4" /> : 'Saqlash'}
      </button>
    </div>
  );
}

/**
 * Admin: taxminiy narxlar va chiqish narxlarini tahrirlash
 */
export default function AdminPricesTab() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [units, setUnits] = useState(['ish']);
  const [error, setError] = useState(null);
  const [specId, setSpecId] = useState(null);
  const [draft, setDraft] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setError(null);
    return api('/admin/prices')
      .then((res) => {
        setData(res.data);
        setUnits(res.units || ['ish']);
        setSpecId((current) => current ?? res.data[0]?.id ?? null);
      })
      .catch(setError);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const group = useMemo(() => data?.find((g) => g.id === specId), [data, specId]);

  if (isTwoFactorError(error)) return <TwoFactorRequired />;
  if (error) return <ErrorState message={error.message} onRetry={load} />;
  if (!data) return <PageLoader />;

  const add = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api('/admin/prices', { method: 'POST', body: { ...toBody(draft), specialization_id: specId, sort_order: (group?.items.length || 0) + 1 } });
      toast.success('Narx qo\'shildi');
      setDraft(EMPTY);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api(`/admin/prices/${toDelete.id}`, { method: 'DELETE' });
      toast.success('Narx o\'chirildi');
      setToDelete(null);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
        <label>
          <span className="label">Soha</span>
          <select className="input" value={specId ?? ''} onChange={(e) => setSpecId(Number(e.target.value))}>
            {mainVerticals.map((v) => (
              <optgroup key={v.id} label={v.name}>
                {data.filter((g) => g.vertical === v.id).map((g) => (
                  <option key={g.id} value={g.id}>{g.icon} {g.name_uz} ({g.items.length})</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {group && <CallFeeEditor group={group} onSaved={load} />}
      </div>

      {group && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 text-xs text-slate-500">
            Mijozlar /prices sahifasida ko'radi. Narx — usta ish haqi (so'm), materiallar alohida. "Eng ko'p" bo'sh bo'lsa: "...dan".
          </div>
          <div className="hidden sm:grid grid-cols-12 gap-2 px-3 pt-3 text-[11px] font-bold text-slate-500">
            <span className="col-span-4">Ish nomi</span>
            <span className="col-span-2">Eng kam</span>
            <span className="col-span-2">Eng ko'p</span>
            <span className="col-span-2">Birlik</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {group.items.map((item) => (
              <PriceRow key={`${item.id}-${item.price_min}-${item.price_max}-${item.is_active}-${item.name}-${item.unit}`} item={item} units={units} onSaved={load} onDelete={setToDelete} />
            ))}
            {group.items.length === 0 && <li className="p-6 text-center text-sm text-slate-400">Bu sohada hali narx yo'q</li>}
          </ul>
          <form onSubmit={add} className="p-3 border-t border-slate-100 bg-slate-50/60 grid grid-cols-2 sm:grid-cols-12 gap-2 items-center">
            <input className="input col-span-2 sm:col-span-4 bg-white" required minLength={2} placeholder="Yangi ish nomi" aria-label="Yangi ish nomi" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <input className="input sm:col-span-2 bg-white" required type="number" min="0" step="1000" placeholder="Eng kam" aria-label="Eng kam narx" value={draft.price_min} onChange={(e) => setDraft({ ...draft, price_min: e.target.value })} />
            <input className="input sm:col-span-2 bg-white" type="number" min="0" step="1000" placeholder="Eng ko'p" aria-label="Eng ko'p narx" value={draft.price_max} onChange={(e) => setDraft({ ...draft, price_max: e.target.value })} />
            <select className="input sm:col-span-2 bg-white" aria-label="O'lchov birligi" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })}>
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <button type="submit" className="btn btn-primary sm:col-span-2" disabled={adding}>
              {adding ? <Spinner className="w-4 h-4 text-white" /> : <><Plus className="w-4 h-4" /> Qo'shish</>}
            </button>
          </form>
          {draft.price_min !== '' && (
            <p className="px-4 pb-3 text-[11px] text-slate-500 bg-slate-50/60">
              Mijozga ko'rinishi: <strong>{formatPriceRange(Number(draft.price_min), draft.price_max === '' ? null : Number(draft.price_max))}</strong>
            </p>
          )}
        </div>
      )}

      {toDelete && (
        <ConfirmDialog
          title={`"${toDelete.name}" o'chirilsinmi?`}
          description="Vaqtincha ko'rsatmaslik uchun ko'z belgisini bosib yashirish ham mumkin."
          confirmLabel="O'chirish"
          loading={deleting}
          onConfirm={remove}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
