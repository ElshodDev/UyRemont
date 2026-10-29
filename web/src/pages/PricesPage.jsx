import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Tag, Search, Info, Zap, Truck, Package } from 'lucide-react';
import EmptyState, { ErrorState } from '../components/EmptyState';
import { api } from '../lib/api';
import { formatPrice, formatPriceRange, PRICE_UNITS } from '../lib/format';
import { useCallMaster } from '../lib/useCallMaster';
import { mainVerticals } from '../data/catalog';

function PriceSkeleton() {
  return (
    <div className="card p-5 animate-pulse space-y-3" aria-hidden="true">
      <div className="h-5 w-1/2 bg-slate-200 rounded" />
      {[1, 2, 3].map((i) => <div key={i} className="h-4 bg-slate-100 rounded" />)}
    </div>
  );
}

/**
 * Taxminiy narxlar: mijoz usta chaqirishdan oldin "qancha turadi?" degan savolga javob oladi
 */
export default function PricesPage() {
  const location = useLocation();
  const callMaster = useCallMaster();
  const [groups, setGroups] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [vertical, setVertical] = useState('all');
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setStatus('loading');
    api('/prices')
      .then(({ data }) => {
        setGroups(data);
        setStatus('ready');
      })
      .catch((err) => {
        setError(err.message);
        setStatus('error');
      });
  }, [reloadKey]);

  // /prices#santexnik havolasi bilan kelganda o'sha bo'limga o'tish
  useEffect(() => {
    if (status !== 'ready' || !location.hash) return;
    const slug = decodeURIComponent(location.hash.slice(1));
    const group = groups.find((g) => g.slug === slug);
    if (group) setVertical(group.vertical);
    setTimeout(() => document.getElementById(`narx-${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, [status, location.hash, groups]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups
      .filter((g) => vertical === 'all' || g.vertical === vertical)
      .map((g) => {
        if (!q || g.name_uz.toLowerCase().includes(q)) return g;
        return { ...g, items: g.items.filter((item) => item.name.toLowerCase().includes(q)) };
      })
      .filter((g) => g.items.length > 0);
  }, [groups, vertical, search]);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full flex-1">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2.5 rounded-2xl bg-blue-600 text-white"><Tag className="w-6 h-6" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Taxminiy narxlar</h1>
          <p className="text-xs sm:text-sm text-slate-500">Toshkent bo'yicha o'rtacha usta ish haqi</p>
        </div>
      </div>

      <div className="card p-4 mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
        <p className="flex gap-2"><Info className="w-4 h-4 text-blue-600 flex-shrink-0" /> Aniq narx usta ishni ko'rgach kelishiladi. Bu narxlar mo'ljal uchun.</p>
        <p className="flex gap-2"><Package className="w-4 h-4 text-blue-600 flex-shrink-0" /> Materiallar (kran, kafel, bo'yoq) narxga kirmaydi.</p>
        <p className="flex gap-2"><Truck className="w-4 h-4 text-blue-600 flex-shrink-0" /> Chiqish narxi — ustaning kelish haqi, ish bajarilsa umumiy summaga kiradi.</p>
      </div>

      <div className="sticky top-16 md:top-20 z-30 -mx-4 px-4 sm:mx-0 sm:px-0 py-2 bg-slate-50/95 backdrop-blur space-y-2 mb-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            className="input pl-9 bg-white"
            placeholder="Ish nomini qidiring, masalan: kran"
            aria-label="Ish nomini qidirish"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[{ id: 'all', name: 'Barchasi', icon: '✨' }, ...mainVerticals].map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVertical(v.id)}
              aria-pressed={vertical === v.id}
              className={`chip ${vertical === v.id ? 'chip-active' : 'bg-white border border-slate-200'}`}
            >
              <span aria-hidden="true">{v.icon}</span> {v.name}
            </button>
          ))}
        </div>
      </div>

      {status === 'loading' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <PriceSkeleton key={i} />)}
        </div>
      )}
      {status === 'error' && <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />}
      {status === 'ready' && visible.length === 0 && (
        <EmptyState title="Hech narsa topilmadi" description="Boshqa so'z bilan qidirib ko'ring yoki usta chaqirib, narxni kelishib oling." />
      )}

      {status === 'ready' && visible.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {visible.map((group) => (
            <section key={group.id} id={`narx-${group.slug}`} className="card overflow-hidden scroll-mt-48" aria-labelledby={`narx-title-${group.slug}`}>
              <div className="p-4 flex items-center justify-between gap-3 border-b border-slate-100">
                <h2 id={`narx-title-${group.slug}`} className="font-bold text-slate-900 flex items-center gap-2 min-w-0">
                  <span className="text-xl" aria-hidden="true">{group.icon}</span>
                  <span className="truncate">{group.name_uz}</span>
                </h2>
                <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                  Chiqish: <span className="text-slate-800">{formatPrice(group.call_fee)}</span>
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {group.items.map((item) => (
                  <li key={item.id} className="px-4 py-3 flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-slate-700">{item.name}</span>
                    <span className="text-right whitespace-nowrap">
                      <span className="font-bold text-slate-900 tabular-nums">{formatPriceRange(item.price_min, item.price_max)}</span>
                      {PRICE_UNITS[item.unit] && <span className="block text-[11px] text-slate-400">{PRICE_UNITS[item.unit]} uchun</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="p-3 bg-slate-50/70 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => callMaster({ vertical: group.vertical, spec: group.slug })}
                  className="btn btn-accent w-full"
                >
                  <Zap className="w-4 h-4" /> {group.name_uz} chaqirish
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
