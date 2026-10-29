import colors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

// =============================================
// Usta24 dizayn tizimi: ranglar CSS o'zgaruvchilari orqali.
// Yorug' rejimda asl Tailwind ranglari ishlatiladi, qorong'i rejimda (html.dark) fon, matn va
// chegara ranglari alohida qayta belgilanadi. Shu sababli bg-white, text-slate-900, bg-blue-50
// kabi klasslar ikkala rejimga ham o'zi moslashadi va har bir elementga dark: yozish shart emas.
// Har doim bir xil qoladigan ranglar kerak bo'lsa: snow (oq) va ink (to'q).
// =============================================

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
// Loyihada ishlatiladigan rangli oilalar (yangisi qo'shilsa, shu ro'yxatga ham yozing)
const ACCENTS = ['blue', 'amber', 'emerald', 'red', 'orange', 'indigo', 'violet', 'sky', 'teal', 'purple', 'green', 'yellow', 'rose'];

const DARK_PAGE = '#0b1220';
const DARK_SURFACE = '#131c2e';

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const channels = (hex) => hexToRgb(hex).join(' ');
// Rang ustiga ikkinchi rangni weight ulushida aralashtirish (qorong'i fondagi och tuslar uchun)
const mix = (hex, baseHex, weight) => {
  const a = hexToRgb(hex);
  const b = hexToRgb(baseHex);
  return a.map((v, i) => Math.round(v * weight + b[i] * (1 - weight))).join(' ');
};

const varName = (kind, name) => `--c-${kind}-${name}`;
const token = (kind, name) => `rgb(var(${varName(kind, name)}) / <alpha-value>)`;

// Qorong'i rejimda qayta belgilanadigan tuslar: { bg: { slate: { 50: '#...' } }, tx: ..., bd: ... }
const dark = { bg: {}, tx: {}, bd: {} };
const setDark = (kind, family, values) => {
  dark[kind][family] = { ...dark[kind][family], ...values };
};

// Kulrang shkala: fonlar to'qlashadi, matn ochlashadi
setDark('bg', 'slate', {
  50: DARK_PAGE, 100: '#1b2538', 200: '#263147', 300: '#334058', 400: '#475569',
  600: '#64748b', 700: '#3b4a61', 800: '#475569', 900: '#334155', 950: '#1e293b'
});
setDark('tx', 'slate', {
  50: '#1e293b', 100: '#273449', 200: '#334155', 300: '#4b5a72', 400: '#7c8aa1',
  500: '#94a3b8', 600: '#aab6c7', 700: '#cbd5e1', 800: '#e2e8f0', 900: '#f1f5f9', 950: '#f8fafc'
});
setDark('bd', 'slate', {
  50: '#172033', 100: '#1b2538', 200: '#243045', 300: '#33405a', 400: '#475569',
  800: '#475569', 900: '#334155'
});

// Rangli tuslar: och fonlar qorong'i fon bilan aralashadi, to'q matnlar ochlashadi.
// O'rta tuslar (400-600) tugma va ikonkalar uchun o'zgarmaydi.
ACCENTS.forEach((family) => {
  const c = colors[family];
  setDark('bg', family, {
    50: mix(c[500], DARK_SURFACE, 0.14),
    100: mix(c[500], DARK_SURFACE, 0.22),
    200: mix(c[500], DARK_SURFACE, 0.32)
  });
  setDark('bd', family, {
    50: mix(c[500], DARK_SURFACE, 0.18),
    100: mix(c[500], DARK_SURFACE, 0.26),
    200: mix(c[500], DARK_SURFACE, 0.36),
    300: mix(c[500], DARK_SURFACE, 0.5)
  });
  setDark('tx', family, {
    500: c[400], 600: c[400], 700: c[300], 800: c[200], 900: c[100], 950: c[50]
  });
});

const lightVars = {
  [varName('bg', 'white')]: '255 255 255',
  [varName('bd', 'white')]: '255 255 255'
};
const darkVars = {
  [varName('bg', 'white')]: channels(DARK_SURFACE),
  [varName('bd', 'white')]: channels(DARK_SURFACE)
};

// Klass ranglari: qayta belgilanadigan tuslar CSS o'zgaruvchisi, qolganlari oddiy rang
const tokens = (kind) => Object.fromEntries(Object.entries(dark[kind]).map(([family, overrides]) => [
  family,
  Object.fromEntries(SHADES.map((shade) => {
    if (!(shade in overrides)) return [shade, colors[family][shade]];
    const name = varName(kind, `${family}-${shade}`);
    lightVars[name] = channels(colors[family][shade]);
    darkVars[name] = overrides[shade].includes('#') ? channels(overrides[shade]) : overrides[shade];
    return [shade, `rgb(var(${name}) / <alpha-value>)`];
  }))
]));

const backgroundTokens = tokens('bg');
const textTokens = tokens('tx');
const borderTokens = tokens('bd');

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        snow: '#ffffff',
        ink: '#0f172a',
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8'
        }
      },
      keyframes: {
        'sheet-up': { from: { transform: 'translateY(24px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'fade-up': { from: { transform: 'translateY(12px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } }
      },
      animation: {
        'sheet-up': 'sheet-up 0.25s ease-out both',
        'fade-up': 'fade-up 0.3s ease-out both'
      },
      backgroundColor: {
        white: token('bg', 'white'),
        ...backgroundTokens
      },
      textColor: textTokens,
      borderColor: {
        DEFAULT: borderTokens.slate['200'],
        white: token('bd', 'white'),
        ...borderTokens
      }
    }
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': { ...lightVars, colorScheme: 'light' },
        '.dark': { ...darkVars, colorScheme: 'dark' }
      });
    })
  ]
};
