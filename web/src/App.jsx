import React, { useState, useMemo } from 'react';
import { 
  Search, MapPin, Star, ShieldCheck, Phone, 
  PlusCircle, CheckCircle, X, Filter, Briefcase,
  Calculator, Send, MessageSquare, ArrowRight,
  Sparkles, Check
} from 'lucide-react';
import { 
  mainVerticals, 
  specializationsByVertical, 
  districtsList, 
  initialMasters 
} from './data/mockMasters';

export default function App() {
  // Asosiy holat
  const [activeVertical, setActiveVertical] = useState('home'); // 'home', 'auto', 'appliance', 'gadget'
  const [masters, setMasters] = useState(initialMasters);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('all');
  const [selectedDistrict, setSelectedDistrict] = useState('Barcha tumanlar');
  const [sortBy, setSortBy] = useState('rating'); // 'rating', 'price_asc', 'price_desc', 'experience'

  // Modallar
  const [activeMaster, setActiveMaster] = useState(null); // Profil modal
  const [orderMaster, setOrderMaster] = useState(null);   // Buyurtma modal
  const [showJoinModal, setShowJoinModal] = useState(false); // Usta qo'shilish
  const [showCalcModal, setShowCalcModal] = useState(false); // Kalkulyator modal

  // Smeta kalkulyatori holati
  const [calcForm, setCalcForm] = useState({
    serviceType: 'santexnik',
    areaOrUnits: 30, // kv metr yoki dona
    repairLevel: 'standard' // 'simple', 'standard', 'premium'
  });

  // Buyurtma formasi
  const [orderForm, setOrderForm] = useState({
    name: '',
    phone: '',
    address: '',
    details: ''
  });
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [lastOrderDetails, setLastOrderDetails] = useState(null);

  // Yangi usta qo'shilish formasi
  const [masterForm, setMasterForm] = useState({
    vertical: 'home',
    name: '',
    phone: '',
    specialization: 'santexnik',
    district: 'Chilonzor',
    experience: 5,
    hourlyRate: 80000,
    bio: ''
  });
  const [masterJoined, setMasterJoined] = useState(false);

  // Hozirgi tanlangan vertikal ma'lumotlari
  const currentVerticalObj = useMemo(() => {
    return mainVerticals.find(v => v.id === activeVertical) || mainVerticals[0];
  }, [activeVertical]);

  // Hozirgi soha mutaxassisliklari
  const currentSpecializations = useMemo(() => {
    return specializationsByVertical[activeVertical] || [];
  }, [activeVertical]);

  // Bo'lim o'zgarganda mutaxassislikni 'all' ga qaytarish
  const handleVerticalChange = (vId) => {
    setActiveVertical(vId);
    setSelectedSpec('all');
    setSearchQuery('');
  };

  // Smeta hisoblash mantiqi
  const calculatedCost = useMemo(() => {
    const baseRates = {
      santexnik: 60000,
      elektrik: 70000,
      malyar: 45000,
      kafel: 90000,
      gipsokarton: 65000,
      motor: 250000,
      konditsioner: 150000,
      iphone: 180000
    };
    const rate = baseRates[calcForm.serviceType] || 50000;
    const multiplier = calcForm.repairLevel === 'simple' ? 0.8 : calcForm.repairLevel === 'premium' ? 1.4 : 1.0;
    const workCost = Math.round(calcForm.areaOrUnits * rate * multiplier);
    const materialCost = Math.round(workCost * 1.3); // Materiallar taxminan 1.3 barobar

    return {
      workCost,
      materialCost,
      totalCost: workCost + materialCost
    };
  }, [calcForm]);

  // Filtrlangan ustalar
  const filteredMasters = useMemo(() => {
    return masters.filter(m => {
      const matchesVertical = m.vertical === activeVertical;
      const matchesSearch = 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.specialization.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.bio.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSpec = selectedSpec === 'all' || m.specId === selectedSpec;
      const matchesDistrict = selectedDistrict === 'Barcha tumanlar' || m.district === selectedDistrict;

      return matchesVertical && matchesSearch && matchesSpec && matchesDistrict;
    }).sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'price_asc') return a.hourlyRate - b.hourlyRate;
      if (sortBy === 'price_desc') return b.hourlyRate - a.hourlyRate;
      if (sortBy === 'experience') return b.experience - a.experience;
      return 0;
    });
  }, [masters, activeVertical, searchQuery, selectedSpec, selectedDistrict, sortBy]);

  // Buyurtma yuborish
  const handleOrderSubmit = (e) => {
    e.preventDefault();
    setLastOrderDetails({
      master: orderMaster,
      clientName: orderForm.name,
      clientPhone: orderForm.phone,
      address: orderForm.address,
      details: orderForm.details
    });
    setOrderSubmitted(true);
  };

  // Telegramga xabar formatini tayyorlash
  const getTelegramShareUrl = () => {
    if (!lastOrderDetails) return '#';
    const text = `🏠 Yangi Buyurtma (Usta24 Platformasi):%0A%0A` +
      `👤 Mijoz: ${lastOrderDetails.clientName}%0A` +
      `📞 Telefon: ${lastOrderDetails.clientPhone}%0A` +
      `📍 Manzil: ${lastOrderDetails.address}%0A` +
      `🛠️ Usta: ${lastOrderDetails.master.name} (${lastOrderDetails.master.specialization})%0A` +
      `📝 Ish tafsilotlari: ${lastOrderDetails.details}`;
    return `https://t.me/share/url?url=${encodeURIComponent('https://uyremont.uz')}&text=${text}`;
  };

  // Yangi usta qo'shish
  const handleMasterJoin = (e) => {
    e.preventDefault();
    const specName = specializationsByVertical[masterForm.vertical]?.find(s => s.id === masterForm.specialization)?.name || 'Mutaxassis';
    const newMaster = {
      id: `m_${Date.now()}`,
      vertical: masterForm.vertical,
      name: masterForm.name,
      phone: masterForm.phone,
      specId: masterForm.specialization,
      specialization: specName,
      rating: 5.0,
      reviewsCount: 1,
      experience: Number(masterForm.experience),
      hourlyRate: Number(masterForm.hourlyRate),
      district: masterForm.district,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
      isVerified: true,
      isAvailable: true,
      bio: masterForm.bio,
      portfolio: []
    };
    setMasters([newMaster, ...masters]);
    setMasterJoined(true);
    setTimeout(() => {
      setMasterJoined(false);
      setShowJoinModal(false);
      setMasterForm({
        vertical: 'home',
        name: '',
        phone: '',
        specialization: 'santexnik',
        district: 'Chilonzor',
        experience: 5,
        hourlyRate: 80000,
        bio: ''
      });
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* 1. TOP HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-md shadow-blue-500/20">
              🛠️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-slate-900">
                  Usta<span className="text-blue-600">24</span>
                </span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-bold rounded-full border border-blue-200 hidden sm:inline-block">
                  SuperApp
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Uy, Avto va Texnika ustalari yagona platformada
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowCalcModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50 text-amber-900 hover:bg-amber-100 font-bold text-xs sm:text-sm border border-amber-200/80 transition"
            >
              <Calculator className="w-4 h-4 text-amber-600" />
              <span>Smeta hisoblash</span>
            </button>

            <button 
              onClick={() => {
                setMasterForm({...masterForm, vertical: activeVertical});
                setShowJoinModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-semibold text-xs sm:text-sm shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Usta bo'lib qo'shilish</span>
              <span className="sm:hidden">Usta bo'lish</span>
            </button>
          </div>
        </div>

        {/* 2. SUPERAPP KATTA VERTİKAL TUGMALARI (NAVBAR) */}
        <div className="bg-slate-100 border-t border-slate-200 px-4">
          <div className="max-w-7xl mx-auto flex items-center gap-2 sm:gap-4 overflow-x-auto py-2 no-scrollbar">
            {mainVerticals.map(v => {
              const isSelected = activeVertical === v.id;
              const count = masters.filter(m => m.vertical === v.id).length;
              return (
                <button
                  key={v.id}
                  onClick={() => handleVerticalChange(v.id)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${
                    isSelected 
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span className="text-lg">{v.icon}</span>
                  <span>{v.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isSelected 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {count} usta
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* 3. HERO BANNER */}
      <section className={`bg-gradient-to-r ${currentVerticalObj.headerTheme} text-white pt-10 pb-16 px-4 transition-all duration-300`}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
            <span>{currentVerticalObj.icon}</span>
            <span>{currentVerticalObj.name} Bo'limi</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
            {activeVertical === 'home' && "Uyingiz ta'miri uchun eng yaxshi ustalar"}
            {activeVertical === 'auto' && "Avtomobilingiz uchun ishonchli avto-ustalar"}
            {activeVertical === 'appliance' && "Konditsioner va maishiy texnika ta'miri"}
            {activeVertical === 'gadget' && "Smartfon va kompyuter servis ustalari"}
          </h1>

          <p className="text-white/80 text-sm sm:text-base mb-6 max-w-2xl mx-auto font-normal">
            {currentVerticalObj.desc} — bevosita telefon raqamlari, narxlar va haqiqiy mijozlar sharhlari bilan.
          </p>

          {/* Qidiruv darchasi */}
          <div className="bg-white p-2.5 rounded-2xl shadow-xl flex flex-col md:flex-row gap-2 text-slate-800 max-w-3xl mx-auto">
            <div className="flex-1 flex items-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-200">
              <Search className="w-5 h-5 text-slate-400 mr-3 flex-shrink-0" />
              <input 
                type="text"
                placeholder={`${currentVerticalObj.name} bo'yicha usta yoki xizmat qidirish...`}
                className="w-full bg-transparent border-none outline-none text-sm placeholder-slate-400 font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 min-w-[200px]">
              <MapPin className="w-5 h-5 text-slate-400 mr-2 flex-shrink-0" />
              <select 
                className="w-full bg-transparent border-none outline-none text-sm font-medium text-slate-700 cursor-pointer"
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
              >
                {districtsList.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SOHAGA MOS KATEGORIYALAR */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <div className="bg-white rounded-2xl p-3 shadow-md border border-slate-200 overflow-x-auto flex gap-2 no-scrollbar">
          {currentSpecializations.map(s => {
            const isSelected = selectedSpec === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSpec(s.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                  isSelected 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. ASOSIY USTALAR RO'YXATI */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {currentVerticalObj.name} ustalari ({filteredMasters.length})
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
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium outline-none text-slate-700"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="rating">Reyting bo'yicha (eng yuqori)</option>
              <option value="experience">Ko'p yillik tajriba</option>
              <option value="price_asc">Arzonroq narx</option>
              <option value="price_desc">Qimmatroq narx</option>
            </select>
          </div>
        </div>

        {/* Ustalar kartochkalari */}
        {filteredMasters.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Mos usta topilmadi</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mb-4">
              Tanlangan filtrlar bo'yicha hozircha usta topilmadi. Filtrni o'zgartirib ko'ring.
            </p>
            <button 
              onClick={() => { setSelectedSpec('all'); setSelectedDistrict('Barcha tumanlar'); setSearchQuery(''); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-blue-700"
            >
              Barchasini ko'rsatish
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMasters.map(m => (
              <div 
                key={m.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col overflow-hidden"
              >
                <div className="p-5 flex-1">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <img 
                        src={m.avatar} 
                        alt={m.name} 
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-100"
                      />
                      {m.isVerified && (
                        <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1" title="Tasdiqlangan usta">
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{m.name}</h3>
                      <p className="text-xs font-semibold text-blue-600 mt-0.5">{m.specialization}</p>

                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center text-amber-500 text-xs font-bold bg-amber-50 px-2 py-0.5 rounded-md">
                          <Star className="w-3.5 h-3.5 fill-current mr-1" />
                          {m.rating}
                        </div>
                        <span className="text-xs text-slate-400">({m.reviewsCount} ta sharh)</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                    {m.bio}
                  </p>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Hudud:</span>
                      <span className="font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {m.district}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Tajriba:</span>
                      <span className="font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                        <Briefcase className="w-3 h-3 text-slate-400" />
                        {m.experience} yil
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Boshlang'ich narx:</span>
                      <span className="font-extrabold text-blue-600 text-sm">
                        {m.hourlyRate.toLocaleString()} so'm
                      </span>
                    </div>

                    <div>
                      {m.isAvailable ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md font-semibold text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Bo'sh
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-1 rounded-md font-semibold text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          Band
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/70 border-t border-slate-100 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setActiveMaster(m)}
                    className="w-full py-2 px-3 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300 transition"
                  >
                    Profilni ko'rish
                  </button>
                  <button
                    onClick={() => {
                      setOrderSubmitted(false);
                      setOrderMaster(m);
                    }}
                    className="w-full py-2 px-3 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition"
                  >
                    Buyurtma berish
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 6. SMETA & NARX KALKULYATORI MODAL */}
      {showCalcModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowCalcModal(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-2xl">
                <Calculator className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Smart Smeta Kalkulyatori</h3>
                <p className="text-xs text-slate-500">Ta'mir va xizmat narxini oldindan hisoblang</p>
              </div>
            </div>

            <div className="space-y-4 my-5 text-xs sm:text-sm">
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Xizmat turini tanlang:</label>
                <select 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-amber-500"
                  value={calcForm.serviceType}
                  onChange={(e) => setCalcForm({...calcForm, serviceType: e.target.value})}
                >
                  <option value="santexnik">Santexnika (Vodoprovod & Isitish)</option>
                  <option value="elektrik">Elektromontaj (Sim tortish & shit)</option>
                  <option value="kafel">Kafel / Plitka yotqizish</option>
                  <option value="malyar">Malyarka & Shpatlyovka devor</option>
                  <option value="gipsokarton">Gipsokarton shift / devor</option>
                  <option value="konditsioner">Konditsioner montaj & tozalash</option>
                  <option value="motor">Avtomobil motorini tuzatish</option>
                  <option value="iphone">Smartfon / iPhone ekrani</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1.5">
                  <span>Hajmi:</span>
                  <span className="text-amber-700 font-extrabold">{calcForm.areaOrUnits} {calcForm.serviceType.includes('iphone') || calcForm.serviceType.includes('motor') ? 'dona/nuqta' : 'kv. metr'}</span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="200" 
                  step="5"
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  value={calcForm.areaOrUnits}
                  onChange={(e) => setCalcForm({...calcForm, areaOrUnits: Number(e.target.value)})}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Ta'mir darajasi:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'simple', label: 'Kosmetik', desc: 'Oddiy & Tez' },
                    { id: 'standard', label: 'Standart', desc: 'Sifatli & Ishonchli' },
                    { id: 'premium', label: 'Evro / Premium', desc: 'Eng yuqori sifat' }
                  ].map(lvl => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setCalcForm({...calcForm, repairLevel: lvl.id})}
                      className={`p-2.5 rounded-xl border text-center transition ${
                        calcForm.repairLevel === lvl.id 
                          ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold' 
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-bold">{lvl.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{lvl.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Natija oynasi */}
              <div className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-500/20 border border-amber-300 rounded-2xl space-y-2 mt-4">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Usta xizmat haqi:</span>
                  <span className="font-bold text-slate-800">{calculatedCost.workCost.toLocaleString()} so'm</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Qurilish materiallari (taxminiy):</span>
                  <span className="font-bold text-slate-800">{calculatedCost.materialCost.toLocaleString()} so'm</span>
                </div>
                <div className="pt-2 border-t border-amber-200 flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-sm">Jami kutilayotgan byudjet:</span>
                  <span className="text-base sm:text-lg font-black text-amber-700">
                    ~{calculatedCost.totalCost.toLocaleString()} so'm
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowCalcModal(false)}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-xs sm:text-sm hover:bg-slate-800 transition"
            >
              Ushbu byudjetga mos usta tanlash
            </button>
          </div>
        </div>
      )}

      {/* 7. PROFIL MODAL */}
      {activeMaster && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative">
            <button 
              onClick={() => setActiveMaster(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 mb-4">
              <img 
                src={activeMaster.avatar} 
                alt={activeMaster.name} 
                className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-100"
              />
              <div>
                <h3 className="text-xl font-bold text-slate-900">{activeMaster.name}</h3>
                <p className="text-sm font-semibold text-blue-600">{activeMaster.specialization}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center text-amber-500 text-xs font-bold">
                    <Star className="w-4 h-4 fill-current mr-1" />
                    {activeMaster.rating}
                  </div>
                  <span className="text-xs text-slate-400">({activeMaster.reviewsCount} ta baholash)</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Usta haqida:</h4>
                <p className="text-slate-600 text-xs leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {activeMaster.bio}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Tajriba</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">{activeMaster.experience} yil</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Tuman</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">{activeMaster.district}</span>
                </div>
              </div>

              {/* Portfolio */}
              {activeMaster.portfolio && activeMaster.portfolio.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Bajarilgan ishlar (Portfolio):</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {activeMaster.portfolio.map((img, i) => (
                      <img key={i} src={img} alt="ish namunasi" className="rounded-xl h-28 w-full object-cover border border-slate-200" />
                    ))}
                  </div>
                </div>
              )}

              {/* Telefon & Bog'lanish */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-xs text-blue-700 font-semibold block">To'g'ridan-to'g'ri raqam:</span>
                  <span className="text-base font-extrabold text-blue-900">{activeMaster.phone}</span>
                </div>
                <a 
                  href={`tel:${activeMaster.phone}`}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Qo'ng'iroq
                </a>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => {
                  setOrderSubmitted(false);
                  setOrderMaster(activeMaster);
                  setActiveMaster(null);
                }}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-md shadow-blue-500/20"
              >
                Ushbu ustaga buyurtma berish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. BUYURTMA BERISH VA TELEGRAM INTEGRATSIYASI MODAL */}
      {orderMaster && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => {
                setOrderMaster(null);
                setOrderSubmitted(false);
              }}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            {orderSubmitted ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">Buyurtma Qabul Qilindi!</h3>
                <p className="text-xs text-slate-500 mb-6">
                  Usta <strong>{orderMaster.name}</strong> 15 daqiqa ichida siz bilan bog'lanadi.
                </p>

                {/* Telegram orqali yuborish tugmasi */}
                <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl mb-4 text-left">
                  <span className="text-xs text-sky-800 font-bold block mb-1">Tezkor tasdiqlash:</span>
                  <p className="text-[11px] text-sky-700 mb-3">
                    Buyurtmani to'g'ridan-to'g'ri Telegram orqali ustaga yuborib, navbatsiz kelishishingiz mumkin.
                  </p>
                  <a
                    href={getTelegramShareUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-4 bg-sky-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-sky-600 transition"
                  >
                    <Send className="w-4 h-4" />
                    Telegram orqali yuborish
                  </a>
                </div>

                <button
                  onClick={() => {
                    setOrderMaster(null);
                    setOrderSubmitted(false);
                    setOrderForm({ name: '', phone: '', address: '', details: '' });
                  }}
                  className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Yopish
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Buyurtma berish</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Usta: <strong className="text-blue-600">{orderMaster.name}</strong> ({orderMaster.specialization})
                </p>

                <form onSubmit={handleOrderSubmit} className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Ismingiz *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ismingizni kiriting"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                      value={orderForm.name}
                      onChange={(e) => setOrderForm({...orderForm, name: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Telefon raqamingiz *</label>
                    <input 
                      type="tel" 
                      required
                      placeholder="+998 90 123 45 67"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                      value={orderForm.phone}
                      onChange={(e) => setOrderForm({...orderForm, phone: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Manzil (Tuman, ko'cha, uy) *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Chilonzor 9-mavze, 12-uy"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                      value={orderForm.address}
                      onChange={(e) => setOrderForm({...orderForm, address: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Ishning qisqa tavsifi *</label>
                    <textarea 
                      rows="3"
                      required
                      placeholder="Qanday muammo bor yoki nima ish bajarilishi kerak..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                      value={orderForm.details}
                      onChange={(e) => setOrderForm({...orderForm, details: e.target.value})}
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-md shadow-blue-500/20 transition mt-2"
                  >
                    Buyurtmani tasdiqlash
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 9. USTA RO'YXATDAN O'TISH MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowJoinModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            {masterJoined ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-3 animate-bounce" />
                <h3 className="text-xl font-bold text-slate-900 mb-1">Xush kelibsiz!</h3>
                <p className="text-xs text-slate-500">
                  Profilingiz yaratildi va tanlangan bo'limga qo'shildi!
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Usta sifatida qo'shilish</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Qaysi sohada xizmat ko'rsatishingizni tanlang va profil yarating.
                </p>

                <form onSubmit={handleMasterJoin} className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Xizmat sohasi *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {mainVerticals.map(v => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            const firstSpec = specializationsByVertical[v.id]?.[1]?.id || 'all';
                            setMasterForm({
                              ...masterForm, 
                              vertical: v.id,
                              specialization: firstSpec
                            });
                          }}
                          className={`p-2 rounded-xl border text-left flex items-center gap-2 transition ${
                            masterForm.vertical === v.id 
                              ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold' 
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="text-base">{v.icon}</span>
                          <span className="text-xs truncate">{v.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Ism va familiyangiz *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Masalan: Davronbek Aliyev"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                      value={masterForm.name}
                      onChange={(e) => setMasterForm({...masterForm, name: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Telefon raqam *</label>
                    <input 
                      type="tel" 
                      required
                      placeholder="+998 90 123 45 67"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                      value={masterForm.phone}
                      onChange={(e) => setMasterForm({...masterForm, phone: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Mutaxassislik *</label>
                      <select 
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                        value={masterForm.specialization}
                        onChange={(e) => setMasterForm({...masterForm, specialization: e.target.value})}
                      >
                        {specializationsByVertical[masterForm.vertical]?.filter(s => s.id !== 'all').map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Tuman *</label>
                      <select 
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                        value={masterForm.district}
                        onChange={(e) => setMasterForm({...masterForm, district: e.target.value})}
                      >
                        {districtsList.filter(d => d !== 'Barcha tumanlar').map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Tajriba (yil) *</label>
                      <input 
                        type="number" 
                        required
                        min="1"
                        max="40"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                        value={masterForm.experience}
                        onChange={(e) => setMasterForm({...masterForm, experience: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Boshlang'ich narx (so'm) *</label>
                      <input 
                        type="number" 
                        required
                        step="5000"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                        value={masterForm.hourlyRate}
                        onChange={(e) => setMasterForm({...masterForm, hourlyRate: e.target.value})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Qisqacha ma'lumot</label>
                    <textarea 
                      rows="2"
                      placeholder="Ish tajribangiz, kafolatlaringiz haqida..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                      value={masterForm.bio}
                      onChange={(e) => setMasterForm({...masterForm, bio: e.target.value})}
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-md shadow-blue-500/20 transition mt-2"
                  >
                    Profilni saqlash
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 10. FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-10 mt-auto border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛠️</span>
            <span className="font-bold text-white text-base">Usta24</span>
            <span>— Uy, Avto va Texnika ustalari SuperApp platformasi</span>
          </div>
          <div>
            © 2026 Usta24 Marketplace. Barcha huquqlar himoyalangan.
          </div>
        </div>
      </footer>
    </div>
  );
}
