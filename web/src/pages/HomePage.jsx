import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, MapPin, Filter, Megaphone, Wrench, Zap, Tag, ArrowRight } from 'lucide-react';
import MasterCard, { MasterCardSkeleton } from '../components/MasterCard';
import MasterProfileModal from '../components/MasterProfileModal';
import OrderModal from '../components/OrderModal';
import EmptyState, { ErrorState } from '../components/EmptyState';
import Spinner from '../components/Spinner';
import { api } from '../lib/api';
import { useSpecializations } from '../lib/useSpecializations';
import { useAuth } from '../context/AuthContext';
import { useCallMaster } from '../lib/useCallMaster';
import { useToast } from '../context/ToastContext';
import { mainVerticals, districtsList, ALL_DISTRICTS } from '../data/catalog';

const PAGE_SIZE = 12;

function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { requireAuth } = useAuth();
  const toast = useToast();
  const { specializations } = useSpecializations();

  // Filtrlar URL da saqlanadi (ulashish va ortga qaytish uchun qulay)
  const activeVertical = mainVerticals.some((v) => v.id === searchParams.get('vertical'))
    ? searchParams.get('vertical')
    : 'home';
  const selectedSpec = searchParams.get('spec') || 'all';
  const selectedDistrict = searchParams.get('district') || ALL_DISTRICTS;
  const sortBy = searchParams.get('sort') || 'rating';

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const debouncedQuery = useDebounced(searchQuery.trim());

  const [masters, setMasters] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [verticalCounts, setVerticalCounts] = useState({});
  const [reloadKey, setReloadKey] = useState(0);

  const [profileMasterId, setProfileMasterId] = useState(null);
  const [orderTarget, setOrderTarget] = useState(null); // { master } yoki { master: null } (ochiq buyurtma)

  const setFilter = useCallback((updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '' || value === 'all' || value === ALL_DISTRICTS) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    setFilter({ q: debouncedQuery });
  }, [debouncedQuery, setFilter]);

  const currentVerticalObj = mainVerticals.find((v) => v.id === activeVertical) || mainVerticals[0];

  const currentSpecializations = useMemo(
    () => specializations.filter((s) => s.vertical === activeVertical),
    [specializations, activeVertical]
  );

  const filters = useMemo(() => ({
    vertical: activeVertical,
    specialization: selectedSpec === 'all' ? undefined : selectedSpec,
    district: selectedDistrict === ALL_DISTRICTS ? undefined : selectedDistrict,
    sort_by: sortBy,
    q: debouncedQuery || undefined,
    limit: PAGE_SIZE
  }), [activeVertical, selectedSpec, selectedDistrict, sortBy, debouncedQuery]);

  useEffect(() => {
    api('/masters/verticals').then(({ data }) => setVerticalCounts(data)).catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    api('/masters', { params: { ...filters, page: 1 }, signal: controller.signal })
      .then(({ data }) => {
        setMasters(data.masters);
        setPagination(data.pagination);
        setStatus('ready');
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setStatus('error');
      });
    return () => controller.abort();
  }, [filters, reloadKey]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const { data } = await api('/masters', { params: { ...filters, page: pagination.page + 1 } });
      setMasters((list) => [...list, ...data.masters]);
      setPagination(data.pagination);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleVerticalChange = (vId) => {
    setSearchQuery('');
    setFilter({ vertical: vId === 'home' ? null : vId, spec: null, q: null });
  };

  const startOrder = (master) => {
    requireAuth((current) => {
      if (current.role !== 'client') {
        toast.error(current.role === 'master'
          ? 'Buyurtma berish uchun profilingizda mijoz rejimiga o\'ting'
          : 'Administrator hisobidan buyurtma berib bo\'lmaydi');
        return;
      }
      setProfileMasterId(null);
      setOrderTarget({ master });
    });
  };

  // Tezkor chaqiruv: tanlangan mutaxassislik bilan /call sahifasiga
  const openCall = useCallMaster();
  const callMaster = () => openCall({ vertical: activeVertical, ...(selectedSpec !== 'all' && { spec: selectedSpec }) });

  const resetFilters = () => {
    setSearchQuery('');
    setFilter({ spec: null, district: null, q: null });
  };

  const defaultSpecId = currentSpecializations.find((s) => s.slug === selectedSpec)?.id;

  return (
    <>
      {/* SUPERAPP VERTIKAL TUGMALARI */}
      <div className="bg-slate-100 border-b border-slate-200 px-4">
        <div className="max-w-7xl mx-auto flex items-center gap-2 sm:gap-4 overflow-x-auto py-2 no-scrollbar">
          {mainVerticals.map((v) => {
            const isSelected = activeVertical === v.id;
            return (
              <button
                key={v.id}
                onClick={() => handleVerticalChange(v.id)}
                aria-pressed={isSelected}
                className={`flex items-center gap-2.5 px-4 min-h-11 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <span className="text-lg">{v.icon}</span>
                <span>{v.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {verticalCounts[v.id] ?? '…'} usta
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* HERO BANNER */}
      <section className={`bg-gradient-to-r ${currentVerticalObj.headerTheme} text-white pt-10 pb-16 px-4 transition-all duration-300`}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
            <span>{currentVerticalObj.icon}</span>
            <span>{currentVerticalObj.name} Bo'limi</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
            {currentVerticalObj.heroTitle}
          </h1>

          <p className="text-white/80 text-sm sm:text-base mb-6 max-w-2xl mx-auto font-normal">
            {currentVerticalObj.desc} — bevosita telefon raqamlari, narxlar va haqiqiy mijozlar sharhlari bilan.
          </p>

          <div className="bg-white p-2.5 rounded-2xl shadow-xl flex flex-col md:flex-row gap-2 text-slate-800 max-w-3xl mx-auto">
            <div className="flex-1 flex items-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-200">
              <Search className="w-5 h-5 text-slate-400 mr-3 flex-shrink-0" />
              <input
                type="search"
                aria-label="Usta yoki xizmat qidirish"
                placeholder={`${currentVerticalObj.name} bo'yicha usta yoki xizmat qidirish...`}
                className="w-full bg-transparent border-none outline-none text-sm placeholder-slate-400 font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 md:min-w-[200px]">
              <MapPin className="w-5 h-5 text-slate-400 mr-2 flex-shrink-0" />
              <select
                className="w-full min-h-9 bg-transparent border-none outline-none text-sm font-medium text-slate-700 cursor-pointer"
                aria-label="Tuman"
                value={selectedDistrict}
                onChange={(e) => setFilter({ district: e.target.value })}
              >
                {districtsList.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
            <button
              onClick={callMaster}
              className="btn btn-accent px-5 font-extrabold shadow-lg shadow-orange-900/30"
            >
              <Zap className="w-4 h-4" />
              Usta chaqirish — eng yaqini keladi
            </button>
            <button
              onClick={() => startOrder(null)}
              className="btn bg-snow/10 hover:bg-snow/20 border border-snow/25 text-white text-xs sm:text-sm"
            >
              <Megaphone className="w-4 h-4" />
              Usta tanlamasdan buyurtma qoldirish
            </button>
          </div>
          <Link
            to="/prices"
            className="mt-4 inline-flex items-center gap-1.5 min-h-11 text-sm font-semibold text-white/90 hover:text-white underline-offset-4 hover:underline"
          >
            <Tag className="w-4 h-4" /> Qancha turadi? Taxminiy narxlarni ko'ring <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* SOHAGA MOS KATEGORIYALAR */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 w-full">
        <div className="bg-white rounded-2xl p-3 shadow-md border border-slate-200 overflow-x-auto flex gap-2 no-scrollbar">
          {[{ id: 'all', slug: 'all', name_uz: 'Barchasi', icon: '✨' }, ...currentSpecializations].map((s) => {
            const isSelected = selectedSpec === s.slug;
            return (
              <button
                key={s.id}
                onClick={() => setFilter({ spec: s.slug })}
                aria-pressed={isSelected}
                className={`chip ${isSelected ? 'chip-active' : ''}`}
              >
                <span>{s.icon}</span>
                <span>{s.name_uz}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ASOSIY USTALAR RO'YXATI */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {currentVerticalObj.name} ustalari {pagination ? `(${pagination.total})` : ''}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Reyting, tajriba va mijozlar sharhlari asosida saralandi
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Filter className="w-4 h-4" /> Saralash:
            </span>
            <select
              className="input w-auto min-h-10 py-1.5 bg-white text-xs sm:text-sm font-medium"
              aria-label="Saralash"
              value={sortBy}
              onChange={(e) => setFilter({ sort: e.target.value === 'rating' ? null : e.target.value })}
            >
              <option value="rating">Reyting bo'yicha (eng yuqori)</option>
              <option value="experience">Ko'p yillik tajriba</option>
              <option value="reviews">Ko'p sharhlar</option>
              <option value="price_asc">Arzonroq narx</option>
              <option value="price_desc">Qimmatroq narx</option>
            </select>
          </div>
        </div>

        {status === 'loading' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }, (_, i) => <MasterCardSkeleton key={i} />)}
          </div>
        )}

        {status === 'error' && <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

        {status === 'ready' && masters.length === 0 && (
          <EmptyState
            title="Mos usta topilmadi"
            description="Tanlangan filtrlar bo'yicha hozircha usta topilmadi. Filtrni o'zgartiring yoki ochiq buyurtma qoldiring."
            action={(
              <div className="flex flex-wrap justify-center gap-2">
                <button onClick={resetFilters} className="btn btn-primary">
                  Barchasini ko'rsatish
                </button>
                <button onClick={() => startOrder(null)} className="btn btn-secondary">
                  Ochiq buyurtma qoldirish
                </button>
              </div>
            )}
          />
        )}

        {status === 'ready' && masters.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {masters.map((m) => (
                <MasterCard
                  key={m.id}
                  master={m}
                  onView={() => setProfileMasterId(m.id)}
                  onOrder={startOrder}
                />
              ))}
            </div>
            {pagination && pagination.page < pagination.totalPages && (
              <div className="text-center mt-8">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="btn btn-secondary px-6"
                >
                  {loadingMore ? <Spinner className="w-4 h-4" /> : 'Ko\'proq ko\'rsatish'}
                </button>
              </div>
            )}
          </>
        )}

        {/* USTALAR UCHUN TAKLIF */}
        <div className="mt-12 rounded-3xl bg-gradient-to-r from-slate-900 to-blue-900 dark:ring-1 dark:ring-white/10 text-white p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-white/10"><Wrench className="w-6 h-6" /></div>
            <div>
              <h3 className="text-lg font-bold">Siz ustamisiz?</h3>
              <p className="text-sm text-white/70 max-w-lg">
                Profil yarating, portfolio qo'shing va o'z tumaningizdagi mijozlardan buyurtmalar oling. Ro'yxatdan o'tish bepul.
              </p>
            </div>
          </div>
          <button
            onClick={() => requireAuth((current) => navigate(current.role === 'master' ? '/master/profile' : '/master/setup'))}
            className="btn bg-snow text-ink font-bold hover:bg-primary-50 whitespace-nowrap px-5"
          >
            Usta bo'lib qo'shilish
          </button>
        </div>
      </main>

      {profileMasterId && (
        <MasterProfileModal
          masterId={profileMasterId}
          onClose={() => setProfileMasterId(null)}
          onOrder={startOrder}
        />
      )}

      {orderTarget && (
        <OrderModal
          master={orderTarget.master}
          specializations={currentSpecializations}
          defaultSpecializationId={defaultSpecId}
          onClose={() => setOrderTarget(null)}
        />
      )}
    </>
  );
}
