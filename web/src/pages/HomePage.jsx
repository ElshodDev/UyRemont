import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Megaphone, Wrench, Zap, Tag, X, SlidersHorizontal } from 'lucide-react';
import MasterCard, { MasterCardSkeleton } from '../components/MasterCard';
import MasterProfileModal from '../components/MasterProfileModal';
import FavoritesStrip from '../components/FavoritesStrip';
import WorkToggle from '../components/WorkToggle';
import OrderModal from '../components/OrderModal';
import EmptyState, { ErrorState } from '../components/EmptyState';
import Spinner from '../components/Spinner';
import FilterSidebar from '../components/catalog/FilterSidebar';
import FilterSheet from '../components/catalog/FilterSheet';
import ActiveFilters from '../components/catalog/ActiveFilters';
import { api } from '../lib/api';
import { useSpecializations } from '../lib/useSpecializations';
import { useAuth } from '../context/AuthContext';
import { useCallMaster } from '../lib/useCallMaster';
import { useToast } from '../context/ToastContext';
import { mainVerticals } from '../data/catalog';
import {
  SORT_OPTIONS, EMPTY_FILTERS, readFilters, filtersToUrl, filtersToApi, countFilters
} from '../lib/catalogFilters';
import { t, specName } from '../i18n';

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
  const { user, requireAuth } = useAuth();
  const toast = useToast();
  const { specializations } = useSpecializations();
  const resultsRef = useRef(null);

  // Hamma tanlov URL da saqlanadi (havolani ulashish, profildan qaytganda tanlov saqlanib qoladi)
  const activeVertical = mainVerticals.some((v) => v.id === searchParams.get('vertical'))
    ? searchParams.get('vertical')
    : 'home';
  const selectedSpec = searchParams.get('spec') || 'all';
  const urlQuery = searchParams.get('q') || '';
  const sortBy = SORT_OPTIONS.some(([value]) => value === searchParams.get('sort'))
    ? searchParams.get('sort')
    : 'recommended';
  // Obyekt faqat filtr qiymatlari o'zgarganda yangilanadi (qidiruv yozilganda emas)
  const panelFiltersKey = JSON.stringify(readFilters(searchParams));
  const panelFilters = useMemo(() => JSON.parse(panelFiltersKey), [panelFiltersKey]);

  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const debouncedQuery = useDebounced(searchQuery.trim());

  const [masters, setMasters] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [verticalCounts, setVerticalCounts] = useState({});
  const [reloadKey, setReloadKey] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [profileMasterId, setProfileMasterId] = useState(null);
  const [orderTarget, setOrderTarget] = useState(null); // { master } yoki { master: null } (ochiq buyurtma)

  const setFilter = useCallback((updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '' || value === 'all') {
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

  const applyPanel = useCallback((partial) => setFilter(filtersToUrl(partial)), [setFilter]);
  const clearPanel = useCallback(() => setFilter(filtersToUrl(EMPTY_FILTERS)), [setFilter]);

  const currentVerticalObj = mainVerticals.find((v) => v.id === activeVertical) || mainVerticals[0];

  const currentSpecializations = useMemo(
    () => specializations.filter((s) => s.vertical === activeVertical),
    [specializations, activeVertical]
  );
  const selectedSpecObj = currentSpecializations.find((s) => s.slug === selectedSpec);

  // Qidiruvda soha tanlanmagan bo'lsa, barcha bo'limlar bo'yicha qidiriladi
  const searchingEverywhere = Boolean(urlQuery) && selectedSpec === 'all';

  // Soha, bo'lim va qidiruv (filtrlar oynasidagi son ham shular bilan hisoblanadi)
  const baseParams = useMemo(() => ({
    vertical: searchingEverywhere ? undefined : activeVertical,
    specialization: selectedSpec === 'all' ? undefined : selectedSpec,
    q: urlQuery || undefined
  }), [searchingEverywhere, activeVertical, selectedSpec, urlQuery]);

  const queryParams = useMemo(() => ({
    ...baseParams,
    ...filtersToApi(panelFilters),
    sort_by: sortBy,
    limit: PAGE_SIZE
  }), [baseParams, panelFilters, sortBy]);

  useEffect(() => {
    api('/masters/verticals').then(({ data }) => setVerticalCounts(data)).catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    api('/masters', { params: { ...queryParams, page: 1 }, signal: controller.signal })
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
  }, [queryParams, reloadKey]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const { data } = await api('/masters', { params: { ...queryParams, page: pagination.page + 1 } });
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

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submitSearch = (e) => {
    e.preventDefault();
    setFilter({ q: searchQuery.trim() });
    e.currentTarget.querySelector('input')?.blur();
    scrollToResults();
  };

  const startOrder = (master) => {
    requireAuth((current) => {
      if (current.role !== 'client') {
        toast.error(current.role === 'master'
          ? t('Buyurtma berish uchun profilingizda mijoz rejimiga o\'ting')
          : t('Administrator hisobidan buyurtma berib bo\'lmaydi'));
        return;
      }
      setProfileMasterId(null);
      setOrderTarget({ master });
    });
  };

  // Tezkor chaqiruv: tanlangan soha bilan /call sahifasiga
  const openCall = useCallMaster();
  const callMaster = () => openCall({ vertical: activeVertical, ...(selectedSpec !== 'all' && { spec: selectedSpec }) });

  const panelCount = countFilters(panelFilters);
  const hasAnySelection = panelCount > 0 || selectedSpec !== 'all' || Boolean(urlQuery);

  const resetAll = () => {
    setSearchQuery('');
    setFilter({ spec: null, q: null, ...filtersToUrl(EMPTY_FILTERS) });
  };

  let listTitle = t('{name} ustalari', { name: t(currentVerticalObj.name) });
  if (searchingEverywhere) listTitle = t('«{q}» bo\'yicha natijalar', { q: urlQuery });
  else if (selectedSpecObj) listTitle = t('{name} ustalari', { name: specName(selectedSpecObj) });

  const defaultSpecId = selectedSpecObj?.id;
  const specTiles = [{ id: 'all', slug: 'all', icon: '✨' }, ...currentSpecializations];

  return (
    <>
      {/* Usta kirganda: ish rejimi tugmalari darhol ko'rinadi */}
      {user?.role === 'master' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 w-full">
          <section aria-label={t('Ish rejimi')} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900">{t('Salom, {name}!', { name: (user.name || '').split(' ')[0] || t('usta') })}</p>
              <Link to="/master/work" className="text-sm text-blue-600 font-semibold hover:underline">{t('Ish rejimi va statistika')}</Link>
            </div>
            <div className="sm:w-80"><WorkToggle size="sm" /></div>
          </section>
        </div>
      )}

      {/* 1. QIDIRUV VA ASOSIY HARAKAT */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white px-4 pt-8 pb-16 sm:pt-12 sm:pb-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-[1.75rem] leading-tight sm:text-4xl md:text-5xl font-extrabold tracking-tight">
            {t('Kerakli ustani tez toping')}
          </h1>
          <p className="mt-3 text-white/80 text-sm sm:text-base max-w-xl mx-auto">
            {t('Uy ta\'miri, avto, maishiy texnika va telefon ustalari — narxi, reytingi va sharhlari bilan.')}
          </p>

          <form onSubmit={submitSearch} role="search" className="mt-6 bg-white rounded-2xl p-1.5 shadow-xl flex items-center gap-1.5 text-slate-800">
            <label htmlFor="home-search" className="sr-only">{t('Usta yoki xizmat qidirish')}</label>
            <Search className="w-5 h-5 text-slate-400 ml-3 flex-shrink-0" aria-hidden="true" />
            <input
              id="home-search"
              type="search"
              enterKeyHint="search"
              placeholder={t('Masalan: santexnik, konditsioner, iPhone ekrani')}
              className="flex-1 min-w-0 min-h-12 bg-transparent border-none outline-none text-base placeholder-slate-400 font-medium [&::-webkit-search-cancel-button]:hidden"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="icon-btn w-10 h-10 flex-shrink-0" aria-label={t('Qidiruvni tozalash')}>
                <X className="w-4 h-4" />
              </button>
            )}
            <button type="submit" className="btn btn-primary min-h-12 px-4 sm:px-6 flex-shrink-0" aria-label={t('Qidirish')}>
              <Search className="w-4 h-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">{t('Qidirish')}</span>
            </button>
          </form>

          <button onClick={callMaster} className="btn btn-accent btn-lg mt-4 w-full sm:w-auto shadow-lg shadow-orange-900/30">
            <Zap className="w-5 h-5" aria-hidden="true" />
            {t('Usta chaqirish — eng yaqini keladi')}
          </button>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm font-semibold text-white/85">
            <button onClick={() => startOrder(null)} className="inline-flex items-center gap-1.5 min-h-11 hover:text-white underline-offset-4 hover:underline">
              <Megaphone className="w-4 h-4" aria-hidden="true" /> {t('Usta tanlamasdan buyurtma qoldirish')}
            </button>
            <Link to="/prices" className="inline-flex items-center gap-1.5 min-h-11 hover:text-white underline-offset-4 hover:underline">
              <Tag className="w-4 h-4" aria-hidden="true" /> {t('Taxminiy narxlar')}
            </Link>
          </div>

        </div>
      </section>

      {/* 2. XIZMATLAR: bo'lim va soha */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 w-full relative">
        <section aria-labelledby="services-title" className="card shadow-lg p-3 sm:p-4">
          <h2 id="services-title" className="sr-only">{t('Xizmatlar')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100">
            {mainVerticals.map((v) => {
              const isSelected = activeVertical === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => handleVerticalChange(v.id)}
                  aria-pressed={isSelected}
                  className={`flex items-center gap-2 px-2.5 sm:px-3 min-h-12 rounded-lg text-left transition ${
                    isSelected ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span className="text-xl flex-shrink-0" aria-hidden="true">{v.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-xs sm:text-sm font-bold leading-tight truncate">{t(v.name)}</span>
                    <span className="block text-[11px] text-slate-500 leading-tight">
                      {verticalCounts[v.id] === undefined ? t('… usta') : t('{n} usta', { n: verticalCounts[v.id] })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid gap-1.5 grid-cols-[repeat(auto-fill,minmax(70px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(96px,1fr))]">
            {specTiles.map((s) => {
              const isSelected = selectedSpec === s.slug;
              return (
                <button
                  key={s.id}
                  onClick={() => setFilter({ spec: s.slug })}
                  aria-pressed={isSelected}
                  className={`flex flex-col items-center justify-start gap-1 px-1 pt-2.5 pb-2 min-h-[76px] rounded-xl border text-center transition ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-500'
                      : 'border-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <span className="text-2xl leading-none" aria-hidden="true">{s.icon}</span>
                  <span className="text-[11px] sm:text-xs font-semibold leading-tight line-clamp-2 break-words w-full">
                    {s.slug === 'all' ? t('Barchasi') : specName(s)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* 3. USTALAR RO'YXATI VA FILTRLAR */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 flex-1 w-full">
        <FavoritesStrip onView={(m) => setProfileMasterId(m.id)} onOrder={startOrder} />

        <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6 lg:items-start">
          <aside className="hidden lg:block lg:sticky lg:top-24" aria-label={t('Filtrlar')}>
            <FilterSidebar value={panelFilters} onChange={applyPanel} onClear={clearPanel} />
          </aside>

          <section ref={resultsRef} className="scroll-mt-20 md:scroll-mt-24 min-w-0" aria-labelledby="results-title">
            <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 mb-3">
              <div className="min-w-0">
                <h2 id="results-title" className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">{listTitle}</h2>
                <p className="text-xs text-slate-500 mt-0.5 min-h-4" aria-live="polite">
                  {status === 'ready' && pagination ? t('{n} ta usta topildi', { n: pagination.total }) : ''}
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="lg:hidden btn btn-secondary min-h-10 px-3 flex-1 sm:flex-none"
                  aria-haspopup="dialog"
                >
                  <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
                  {t('Filtrlar')}
                  {panelCount > 0 && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold inline-flex items-center justify-center">
                      {panelCount}
                    </span>
                  )}
                </button>
                <select
                  className="input min-h-10 py-1.5 bg-white text-xs sm:text-sm font-semibold flex-1 min-w-0 w-0 sm:w-auto sm:flex-none"
                  aria-label={t('Saralash')}
                  value={sortBy}
                  onChange={(e) => setFilter({ sort: e.target.value === 'recommended' ? null : e.target.value })}
                >
                  {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
                </select>
              </div>
            </div>

            <ActiveFilters filters={panelFilters} onChange={applyPanel} onClear={clearPanel} />

            {status === 'loading' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {Array.from({ length: 6 }, (_, i) => <MasterCardSkeleton key={i} />)}
              </div>
            )}

            {status === 'error' && <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

            {status === 'ready' && masters.length === 0 && (
              <EmptyState
                title={t('Mos usta topilmadi')}
                description={hasAnySelection
                  ? t('Filtrlarni yumshatib ko\'ring yoki ochiq buyurtma qoldiring: bo\'sh ustalar o\'zi taklif yuboradi.')
                  : t('Bu bo\'limda hozircha usta yo\'q. Ochiq buyurtma qoldiring: bo\'sh ustalar o\'zi taklif yuboradi.')}
                action={(
                  <div className="flex flex-wrap justify-center gap-2">
                    {hasAnySelection && (
                      <button onClick={resetAll} className="btn btn-primary">
                        {t('Filtrlarni tozalash')}
                      </button>
                    )}
                    <button onClick={() => startOrder(null)} className="btn btn-secondary">
                      {t('Ochiq buyurtma qoldirish')}
                    </button>
                  </div>
                )}
              />
            )}

            {status === 'ready' && masters.length > 0 && (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
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
                  <div className="text-center mt-6">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="btn btn-secondary px-6"
                    >
                      {loadingMore ? <Spinner className="w-4 h-4" /> : t('Yana {n} ta ko\'rsatish', {
                        n: Math.min(PAGE_SIZE, pagination.total - masters.length)
                      })}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {/* USTALAR UCHUN TAKLIF */}
        <div className="mt-12 rounded-3xl bg-gradient-to-r from-slate-900 to-blue-900 dark:ring-1 dark:ring-white/10 text-white p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-white/10"><Wrench className="w-6 h-6" /></div>
            <div>
              <h3 className="text-lg font-bold">{t('Siz ustamisiz?')}</h3>
              <p className="text-sm text-white/70 max-w-lg">
                {t('Profil yarating, portfolio qo\'shing va o\'z tumaningizdagi mijozlardan buyurtmalar oling. Ro\'yxatdan o\'tish bepul.')}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Link to="/ustalar" className="btn bg-white/10 text-white hover:bg-white/20 ring-1 ring-white/25 whitespace-nowrap px-5">
              {t('Batafsil')}
            </Link>
            <button
              onClick={() => navigate(user?.role === 'master' ? '/master/profile' : '/usta-bolish')}
              className="btn bg-snow text-ink font-bold hover:bg-primary-50 whitespace-nowrap px-5"
            >
              {t('Usta bo\'lib qo\'shilish')}
            </button>
          </div>
        </div>
      </main>

      {sheetOpen && (
        <FilterSheet
          initial={panelFilters}
          baseParams={baseParams}
          onApply={(next) => {
            applyPanel(next);
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}

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
