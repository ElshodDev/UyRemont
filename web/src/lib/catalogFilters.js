// Ustalar katalogi filtrlari: URL parametrlari <-> filtr obyekti <-> API parametrlari.
// Filtrlar manzilda saqlanadi: havolani ulashish va "orqaga" tugmasi ishlaydi.
import { t } from '../i18n';
import { formatPrice } from './format';
import { ALL_DISTRICTS } from '../data/catalog';

export const SORT_OPTIONS = [
  ['recommended', 'Tavsiya etilgan'],
  ['rating', 'Reyting bo\'yicha (eng yuqori)'],
  ['reviews', 'Ko\'p sharhlar'],
  ['experience', 'Ko\'p yillik tajriba'],
  ['price_asc', 'Arzonroq narx'],
  ['price_desc', 'Qimmatroq narx']
];

export const RATING_OPTIONS = [['', 'Hammasi'], ['4', '4+'], ['4.5', '4.5+']];
export const EXPERIENCE_OPTIONS = [['', 'Hammasi'], ['3', '3+'], ['5', '5+'], ['10', '10+']];

const TOGGLES = ['verified', 'available', 'reviews'];

/**
 * Panel ichidagi filtrlar (soha, bo'lim, qidiruv va saralash bundan tashqari)
 */
export const EMPTY_FILTERS = {
  district: '',
  min_price: '',
  max_price: '',
  rating: '',
  exp: '',
  verified: false,
  available: false,
  reviews: false
};

const numberOrEmpty = (value) => (value && /^\d+(\.\d+)?$/.test(value) ? value : '');

/**
 * URL dan panel filtrlari
 * @param {URLSearchParams} params
 */
export function readFilters(params) {
  const district = params.get('district') || '';
  return {
    district: district === ALL_DISTRICTS ? '' : district,
    min_price: numberOrEmpty(params.get('min_price')),
    max_price: numberOrEmpty(params.get('max_price')),
    rating: RATING_OPTIONS.some(([v]) => v && v === params.get('rating')) ? params.get('rating') : '',
    exp: EXPERIENCE_OPTIONS.some(([v]) => v && v === params.get('exp')) ? params.get('exp') : '',
    verified: params.get('verified') === '1',
    available: params.get('available') === '1',
    reviews: params.get('reviews') === '1'
  };
}

/**
 * Panel filtrlarini URL parametrlariga (bo'sh qiymatlar o'chiriladi)
 */
export function filtersToUrl(filters) {
  const out = {};
  Object.entries(filters).forEach(([key, value]) => {
    out[key] = TOGGLES.includes(key) ? (value ? '1' : null) : (value || null);
  });
  return out;
}

/**
 * API parametrlari (GET /api/masters)
 */
export function filtersToApi(filters) {
  return {
    district: filters.district || undefined,
    min_rate: filters.min_price || undefined,
    max_rate: filters.max_price || undefined,
    min_rating: filters.rating || undefined,
    min_experience: filters.exp || undefined,
    verified: filters.verified ? 'true' : undefined,
    available: filters.available ? 'true' : undefined,
    has_reviews: filters.reviews ? 'true' : undefined
  };
}

/**
 * Nechta filtr tanlangan ("Filtrlar (3)" tugmasi uchun)
 */
export function countFilters(filters) {
  return Object.entries(filters).filter(([, value]) => Boolean(value)).length
    - (filters.min_price && filters.max_price ? 1 : 0);
}

/**
 * Tanlangan filtrlar chiplari: [{ key, label, reset }] (reset - shu filtrni olib tashlash uchun qiymatlar)
 */
export function activeFilterChips(filters) {
  const chips = [];
  if (filters.district) chips.push({ key: 'district', label: t(filters.district), reset: { district: '' } });
  if (filters.min_price || filters.max_price) {
    const label = filters.min_price && filters.max_price
      ? `${formatPrice(filters.min_price)} – ${formatPrice(filters.max_price)}`
      : filters.min_price
        ? t('{price}dan', { price: formatPrice(filters.min_price) })
        : t('{price}gacha', { price: formatPrice(filters.max_price) });
    chips.push({ key: 'price', label, reset: { min_price: '', max_price: '' } });
  }
  if (filters.rating) chips.push({ key: 'rating', label: t('Reyting {n}+', { n: filters.rating }), reset: { rating: '' } });
  if (filters.exp) chips.push({ key: 'exp', label: t('Tajriba {n}+ yil', { n: filters.exp }), reset: { exp: '' } });
  if (filters.verified) chips.push({ key: 'verified', label: t('Faqat tasdiqlangan'), reset: { verified: false } });
  if (filters.available) chips.push({ key: 'available', label: t('Hozir bo\'sh'), reset: { available: false } });
  if (filters.reviews) chips.push({ key: 'reviews', label: t('Sharhi bor'), reset: { reviews: false } });
  return chips;
}
