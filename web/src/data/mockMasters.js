// 4 ta asosiy vertikal bo'lim
export const mainVerticals = [
  {
    id: 'home',
    name: 'Uy & Remont',
    icon: '🏠',
    desc: 'Santexnik, elektrik, kafel, malyar va mebel',
    badge: 'Ommabop',
    headerTheme: 'from-blue-600 to-blue-800'
  },
  {
    id: 'auto',
    name: 'Avto-Usta',
    icon: '🚗',
    desc: 'Motorchi, xodovoy, avtoelektrik, diagnostika',
    badge: 'Yangi',
    headerTheme: 'from-slate-800 to-red-900'
  },
  {
    id: 'appliance',
    name: 'Maishiy Texnika',
    icon: '🔌',
    desc: 'Konditsioner, kir yuvish, muzlatgich, gaz plita',
    badge: 'Yangi',
    headerTheme: 'from-emerald-700 to-teal-900'
  },
  {
    id: 'gadget',
    name: 'Telefon & Komp',
    icon: '📱',
    desc: 'Ekran almashtirish, noutbuk tuzatish, Windows',
    badge: 'Yangi',
    headerTheme: 'from-indigo-700 to-purple-900'
  }
];

export const specializationsByVertical = {
  home: [
    { id: 'all', name: 'Barchasi', icon: '✨' },
    { id: 'santexnik', name: 'Santexnik', icon: '🔧' },
    { id: 'elektrik', name: 'Elektrik', icon: '⚡' },
    { id: 'malyar', name: 'Malyar / Bo\'yoqchi', icon: '🎨' },
    { id: 'kafel', name: 'Kafel / Plitka', icon: '🧱' },
    { id: 'gipsokarton', name: 'Gipsokarton', icon: '📐' },
    { id: 'mebel', name: 'Duradgor / Mebel', icon: '🪚' },
    { id: 'oboy', name: 'Fon qog\'oz (Oboy)', icon: '📜' },
    { id: 'laminat', name: 'Laminat / Pol', icon: '🪵' }
  ],
  auto: [
    { id: 'all', name: 'Barchasi', icon: '✨' },
    { id: 'motor', name: 'Motorchi (Dvigatel)', icon: '⚙️' },
    { id: 'xodovoy', name: 'Xodovoy qism', icon: '🛞' },
    { id: 'avtoelektrik', name: 'Avtoelektrik & Magicar', icon: '⚡' },
    { id: 'diagnostika', name: 'Kompyuter diagnostika', icon: '💻' },
    { id: 'kuzov', name: 'Kuzov & Malyarka', icon: '🚗' },
    { id: 'moy', name: 'Moy almashtirish', icon: '🛢️' }
  ],
  appliance: [
    { id: 'all', name: 'Barchasi', icon: '✨' },
    { id: 'konditsioner', name: 'Konditsioner montaj & tozalash', icon: '❄️' },
    { id: 'kir_yuvish', name: 'Kir yuvish mashinasi', icon: '🫧' },
    { id: 'muzlatgich', name: 'Muzlatgich & Xolodilnik', icon: '🧊' },
    { id: 'gaz_plita', name: 'Gaz plita & Duxovka', icon: '🔥' },
    { id: 'qozon', name: 'Isitish qozonlari (Kotel)', icon: '♨️' }
  ],
  gadget: [
    { id: 'all', name: 'Barchasi', icon: '✨' },
    { id: 'iphone', name: 'iPhone & iPad ta\'miri', icon: '🍏' },
    { id: 'android', name: 'Android (Samsung, Xiaomi)', icon: '📱' },
    { id: 'noutbuk', name: 'Noutbuk & Kompyuter', icon: '💻' },
    { id: 'ekran', name: 'Displey almashtirish', icon: '🔍' },
    { id: 'windows', name: 'Windows & Dasturlar', icon: '💿' }
  ]
};

export const districtsList = [
  'Barcha tumanlar',
  'Chilonzor',
  'Yunusobod',
  'Mirzo Ulug\'bek',
  'Yakkasaroy',
  'Mirobod',
  'Sergeli',
  'Uchtepa',
  'Shayxontohur',
  'Olmazor',
  'Yashnobod'
];

export const initialMasters = [
  // --- UY & REMONT ---
  {
    id: 'm1',
    vertical: 'home',
    name: 'Jamshid Karimov',
    phone: '+998 90 111 22 33',
    specId: 'santexnik',
    specialization: 'Santexnik usta',
    rating: 4.9,
    reviewsCount: 34,
    experience: 12,
    hourlyRate: 80000,
    district: 'Chilonzor',
    avatar: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=400&auto=format&fit=crop&q=80',
    isVerified: true,
    isAvailable: true,
    bio: '12 yillik tajribaga ega santexnikman. Isitish tizimlari, vanna jihozlari, vodoprovod va kanalizatsiya ishlarini sifatli kafolat bilan bajaraman.',
    portfolio: [
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=600&auto=format&fit=crop&q=80'
    ]
  },
  {
    id: 'm2',
    vertical: 'home',
    name: 'Sherzod Aliyev',
    phone: '+998 90 222 33 44',
    specId: 'elektrik',
    specialization: 'Elektrik / Avtomatika',
    rating: 4.8,
    reviewsCount: 29,
    experience: 8,
    hourlyRate: 90000,
    district: 'Yunusobod',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    isVerified: true,
    isAvailable: true,
    bio: 'Kvartira va xususiy uylarda noldan elektr simlarini tortish, shit yig\'ish, lyustra va svetodiodlar ulash bo\'yicha mutaxassis.',
    portfolio: [
      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&auto=format&fit=crop&q=80'
    ]
  },
  {
    id: 'm3',
    vertical: 'home',
    name: 'Rustam Qosimov',
    phone: '+998 90 333 44 55',
    specId: 'kafel',
    specialization: 'Kafel va Plitkachi',
    rating: 5.0,
    reviewsCount: 42,
    experience: 10,
    hourlyRate: 100000,
    district: 'Mirzo Ulug\'bek',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
    isVerified: true,
    isAvailable: true,
    bio: 'Har qanday o\'lchamdagi kafel, granit va mozaika yotqizish. 45 gradus aniq kesim, lazerli nivelir bilan tekislik kafolati.',
    portfolio: [
      'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600&auto=format&fit=crop&q=80'
    ]
  },
  {
    id: 'm4',
    vertical: 'home',
    name: 'Akmal Rahimov',
    phone: '+998 90 444 55 66',
    specId: 'malyar',
    specialization: 'Malyar va Shpatlyovka',
    rating: 4.7,
    reviewsCount: 18,
    experience: 6,
    hourlyRate: 70000,
    district: 'Yakkasaroy',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&auto=format&fit=crop&q=80',
    isVerified: false,
    isAvailable: true,
    bio: 'Devorlarni tekislash, sifatli bo\'yash va zamonaviy dekorativ suvoqlar tayyorlash. Tez va ozoda topshiramiz.',
    portfolio: []
  },

  // --- AVTO-USTA ---
  {
    id: 'a1',
    vertical: 'auto',
    name: 'Davronbek Xolmatov',
    phone: '+998 97 710 40 50',
    specId: 'motor',
    specialization: 'Motorist / Dvigatel ustasi',
    rating: 4.9,
    reviewsCount: 48,
    experience: 14,
    hourlyRate: 120000,
    district: 'Sergeli',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&auto=format&fit=crop&q=80',
    isVerified: true,
    isAvailable: true,
    bio: 'Chevrolet (Cobalt, Gentra, Tracker, Malibu) va xorijiy avtomobillar motorini noldan kapital ta\'mirlash. 6 oy yozma kafolat.',
    portfolio: [
      'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600&auto=format&fit=crop&q=80'
    ]
  },
  {
    id: 'a2',
    vertical: 'auto',
    name: 'Anvar Islomov',
    phone: '+998 93 505 12 34',
    specId: 'avtoelektrik',
    specialization: 'Avtoelektrik & Magicar',
    rating: 4.8,
    reviewsCount: 31,
    experience: 9,
    hourlyRate: 85000,
    district: 'Olmazor',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80',
    isVerified: true,
    isAvailable: true,
    bio: 'Signalizatsiya, Magicar, Starline, videoregistrator o\'rnatish, generator va starter tuzatish, qisqa tutashuvlarni aniqlash.',
    portfolio: []
  },
  {
    id: 'a3',
    vertical: 'auto',
    name: 'Qodir aka Xodovik',
    phone: '+998 91 333 88 99',
    specId: 'xodovoy',
    specialization: 'Xodovoy va Podveska',
    rating: 5.0,
    reviewsCount: 62,
    experience: 16,
    hourlyRate: 95000,
    district: 'Chilonzor',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80',
    isVerified: true,
    isAvailable: true,
    bio: 'Amortizator, rul tyaga, sharovoy, tormoz kolodkalarini almashtirish. Mashinadagi har qanday taqillash va ovozlarni topib tuzatamiz.',
    portfolio: []
  },

  // --- MAISHIY TEXNIKA ---
  {
    id: 'ap1',
    vertical: 'appliance',
    name: 'Temur Valiyev',
    phone: '+998 90 999 55 44',
    specId: 'konditsioner',
    specialization: 'Konditsioner mutaxassisi',
    rating: 4.9,
    reviewsCount: 53,
    experience: 7,
    hourlyRate: 90000,
    district: 'Mirzo Ulug\'bek',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=80',
    isVerified: true,
    isAvailable: true,
    bio: 'Konditsioner o\'rnatish, freon quyish (R410, R32), parogeneratorda chuqur dezinfeksiya va tozalash. Uyga borib tezkor xizmat.',
    portfolio: [
      'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=600&auto=format&fit=crop&q=80'
    ]
  },
  {
    id: 'ap2',
    vertical: 'appliance',
    name: 'Muzaffar Toshmatov',
    phone: '+998 94 620 30 40',
    specId: 'kir_yuvish',
    specialization: 'Kir yuvish & Muzlatgich',
    rating: 4.7,
    reviewsCount: 27,
    experience: 11,
    hourlyRate: 80000,
    district: 'Uchtepa',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80',
    isVerified: true,
    isAvailable: true,
    bio: 'LG, Samsung, Artel, Bosch kir yuvish mashinalari teni, nasosi va elektron platasini joyida ta\'mirlash.',
    portfolio: []
  },

  // --- GADJET & KOMPYUTER ---
  {
    id: 'g1',
    vertical: 'gadget',
    name: 'Farrux ProTech',
    phone: '+998 90 888 77 66',
    specId: 'iphone',
    specialization: 'Apple & Smartfon ta\'miri',
    rating: 5.0,
    reviewsCount: 39,
    experience: 8,
    hourlyRate: 95000,
    district: 'Mirobod',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    isVerified: true,
    isAvailable: true,
    bio: 'iPhone displey, akkumulyator almashtirish, Face ID va plata ta\'miri. Asl (original) qismlar va 3 oy kafolat.',
    portfolio: []
  },
  {
    id: 'g2',
    vertical: 'gadget',
    name: 'Shohruh Kompyuter',
    phone: '+998 99 444 11 22',
    specId: 'noutbuk',
    specialization: 'Noutbuk & IT xizmatlari',
    rating: 4.8,
    reviewsCount: 22,
    experience: 6,
    hourlyRate: 70000,
    district: 'Shayxontohur',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
    isVerified: true,
    isAvailable: true,
    bio: 'Noutbuklarni qizib ketishdan tozalash (termopasta almashtirish), Windows 10/11, litsenziyali dasturlar o\'rnatish va ma\'lumotlarni tiklash.',
    portfolio: []
  }
];
