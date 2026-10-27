// 4 ta asosiy vertikal bo'lim (mutaxassisliklar API dan keladi: /api/masters/specializations)
export const mainVerticals = [
  {
    id: 'home',
    heroTitle: "Uyingiz ta'miri uchun eng yaxshi ustalar",
    name: 'Uy & Remont',
    icon: '🏠',
    desc: 'Santexnik, elektrik, kafel, malyar va mebel',
    badge: 'Ommabop',
    headerTheme: 'from-blue-600 to-blue-800'
  },
  {
    id: 'auto',
    heroTitle: "Avtomobilingiz uchun ishonchli avto-ustalar",
    name: 'Avto-Usta',
    icon: '🚗',
    desc: 'Motorchi, xodovoy, avtoelektrik, diagnostika',
    badge: 'Yangi',
    headerTheme: 'from-slate-800 to-red-900'
  },
  {
    id: 'appliance',
    heroTitle: "Konditsioner va maishiy texnika ta'miri",
    name: 'Maishiy Texnika',
    icon: '🔌',
    desc: 'Konditsioner, kir yuvish, muzlatgich, gaz plita',
    badge: 'Yangi',
    headerTheme: 'from-emerald-700 to-teal-900'
  },
  {
    id: 'gadget',
    heroTitle: "Smartfon va kompyuter servis ustalari",
    name: 'Telefon & Komp',
    icon: '📱',
    desc: 'Ekran almashtirish, noutbuk tuzatish, Windows',
    badge: 'Yangi',
    headerTheme: 'from-indigo-700 to-purple-900'
  }
];

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

export const ALL_DISTRICTS = districtsList[0];

// Smeta kalkulyatori: xizmat turi -> (bo'lim, mutaxassislik slug, 1 birlik narxi)
export const calculatorServices = [
  { id: 'santexnik', label: 'Santexnika (Vodoprovod & Isitish)', vertical: 'home', rate: 60000, unit: 'kv. metr' },
  { id: 'elektrik', label: 'Elektromontaj (Sim tortish & shit)', vertical: 'home', rate: 70000, unit: 'kv. metr' },
  { id: 'kafel', label: 'Kafel / Plitka yotqizish', vertical: 'home', rate: 90000, unit: 'kv. metr' },
  { id: 'malyar', label: 'Malyarka & Shpatlyovka devor', vertical: 'home', rate: 45000, unit: 'kv. metr' },
  { id: 'gipsokarton', label: 'Gipsokarton shift / devor', vertical: 'home', rate: 65000, unit: 'kv. metr' },
  { id: 'konditsioner', label: 'Konditsioner montaj & tozalash', vertical: 'appliance', rate: 150000, unit: 'dona' },
  { id: 'motor', label: 'Avtomobil motorini tuzatish', vertical: 'auto', rate: 250000, unit: 'dona/nuqta' },
  { id: 'iphone', label: 'Smartfon / iPhone ekrani', vertical: 'gadget', rate: 180000, unit: 'dona' }
];

export const repairLevels = [
  { id: 'simple', label: 'Kosmetik', desc: 'Oddiy & Tez', multiplier: 0.8 },
  { id: 'standard', label: 'Standart', desc: 'Sifatli & Ishonchli', multiplier: 1.0 },
  { id: 'premium', label: 'Evro / Premium', desc: 'Eng yuqori sifat', multiplier: 1.4 }
];
