import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ShieldCheck, AlertTriangle } from 'lucide-react';

// DIQQAT: bu matnlar namuna. Ishga tushirishdan oldin yurist tomonidan tekshirilishi
// va [kvadrat qavs] ichidagi ma'lumotlar (kompaniya, manzil, server joylashuvi) to'ldirilishi kerak.
const UPDATED = '2026-yil oktabr';

const TERMS = {
  title: 'Foydalanish shartlari',
  icon: FileText,
  sections: [
    ['1. Umumiy qoidalar', [
      'Usta24 (keyingi o\'rinlarda — Platforma) mijozlar va mustaqil ustalarni bog\'lovchi onlayn xizmatdir. Platforma egasi: [Kompaniya nomi, STIR, manzil].',
      'Platformadan foydalanish (ro\'yxatdan o\'tish, buyurtma berish yoki qabul qilish) ushbu shartlarga rozilik bildirishni anglatadi.',
      'Platforma ta\'mirlash ishlarini o\'zi bajarmaydi: ishni mustaqil usta bajaradi va ish sifati uchun usta javobgar.'
    ]],
    ['2. Ro\'yxatdan o\'tish', [
      'Ro\'yxatdan o\'tish telefon raqam va SMS kod orqali amalga oshiriladi. Bitta odam bitta hisobga ega bo\'lishi kerak.',
      'Hisobingiz xavfsizligi uchun SMS kodni hech kimga bermang. Platforma xodimlari kodni hech qachon so\'ramaydi.'
    ]],
    ['3. Mijozning majburiyatlari', [
      'Buyurtmada to\'g\'ri manzil, muammo tavsifi va aloqa ma\'lumotlarini ko\'rsatish.',
      'Kelishilgan ish uchun ustaga o\'z vaqtida to\'lov qilish.',
      'Tezkor chaqiruvni qabul qilingandan keyin asossiz bekor qilmaslik (batafsil: «Ishlash qoidalari» sahifasi).'
    ]],
    ['4. Ustaning majburiyatlari', [
      'Profilda haqiqiy ma\'lumotlarni ko\'rsatish va administrator tekshiruvidan o\'tish.',
      'Ishni sifatli, kelishilgan muddat va narxda bajarish; ish narxini boshlashdan oldin mijoz bilan kelishish.',
      'Faoliyatni O\'zbekiston Respublikasi qonunchiligiga muvofiq yuritish va soliq majburiyatlarini bajarish.'
    ]],
    ['5. Narx, to\'lov va komissiya', [
      'Chiqish narxi chaqiruvdan oldin ko\'rsatiladi; ish narxi usta bilan joyida kelishiladi.',
      'Tezkor chaqiruvlar bo\'yicha Platforma ustadan yakuniy summaning [10]% miqdorida komissiya oladi.'
    ]],
    ['6. Taqiqlangan harakatlar', [
      'Soxta buyurtma va sharhlar, boshqa foydalanuvchilarni haqorat qilish yoki aldash, Platformani buzishga urinish.',
      'Qoidabuzarlik aniqlansa, hisob ogohlantirishsiz bloklanishi mumkin.'
    ]],
    ['7. Javobgarlik va nizolar', [
      'Platforma foydalanuvchilar o\'rtasidagi nizolarni hal qilishda yordam beradi, lekin usta bajargan ish uchun bevosita javobgar emas.',
      'Nizolar muzokaralar yo\'li bilan, kelishuvga erishilmasa O\'zbekiston Respublikasi qonunchiligiga muvofiq hal qilinadi.'
    ]],
    ['8. O\'zgartirishlar va aloqa', [
      'Shartlar o\'zgarganda foydalanuvchilar ilova orqali xabardor qilinadi.',
      'Aloqa: [telefon], [Telegram], [email].'
    ]]
  ]
};

const PRIVACY = {
  title: 'Maxfiylik siyosati',
  icon: ShieldCheck,
  sections: [
    ['1. Qanday ma\'lumotlar yig\'iladi', [
      'Telefon raqam va ism — ro\'yxatdan o\'tish va aloqa uchun.',
      'Buyurtma ma\'lumotlari: manzil, muammo tavsifi, yozishmalar, sharhlar.',
      'Joylashuv: mijozda — chaqiruv manzilini belgilashda; ustada — faqat ish rejimi yoqilganda yoki faol ish paytida.',
      'Usta yuklagan rasmlar. Rasmlardagi yashirin ma\'lumotlar (GPS koordinatalar, qurilma modeli) yuklanganda avtomatik o\'chiriladi.'
    ]],
    ['2. Ma\'lumotlar nima uchun ishlatiladi', [
      'Buyurtmani eng yaqin ustaga yetkazish, mijoz va ustani bog\'lash, xizmat sifatini (reyting) ta\'minlash.',
      'Firibgarlik va suiiste\'molning oldini olish, qonun talablarini bajarish.',
      'Ma\'lumotlar reklama maqsadida uchinchi shaxslarga sotilmaydi.'
    ]],
    ['3. Kim ko\'radi', [
      'Telefon raqamingiz ikkinchi tomonga faqat buyurtma qabul qilingandan keyin ko\'rsatiladi.',
      'Ustaning joylashuvi mijozga faqat usta yo\'lda bo\'lgan vaqtda ko\'rsatiladi.',
      'Administratorlar qoidabuzarlik va nizolarni ko\'rib chiqish uchun ma\'lumotlarga kira oladi; ularning amallari jurnalga yoziladi.'
    ]],
    ['4. Saqlash va himoya', [
      'Ma\'lumotlar [server joylashuvi — O\'zbekiston qonunchiligi talabiga ko\'ra O\'zbekiston hududidagi server] da saqlanadi.',
      'Aloqa shifrlangan (HTTPS), administratorlar uchun ikki bosqichli kirish qo\'llaniladi.'
    ]],
    ['5. Sizning huquqlaringiz', [
      'Ma\'lumotlaringizni ko\'rish va tuzatish: Profil sahifasida.',
      'Hisobni va shaxsiy ma\'lumotlarni o\'chirish: Profil → Xavfsizlik → «Hisobni o\'chirish». Bajarilgan buyurtmalar ikkinchi tomon tarixi uchun ismsiz holda qoladi.',
      'Rozilikni qaytarib olish va savollar: [email], [telefon].'
    ]],
    ['6. Qurilmada saqlanadigan ma\'lumotlar', [
      'Tizimga kirganingizni eslab qolish uchun brauzerda kirish tokeni saqlanadi. «Chiqish» yoki «Barcha qurilmalardan chiqish» uni bekor qiladi.'
    ]]
  ]
};

function LegalPage({ doc }) {
  const Icon = doc.icon;
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full flex-1">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600"><Icon className="w-6 h-6" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{doc.title}</h1>
          <p className="text-xs text-slate-500">Oxirgi tahrir: {UPDATED}</p>
        </div>
      </div>
      <p className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        Hujjat loyihasi: rasmiy ishga tushirishdan oldin yurist tomonidan tasdiqlanadi.
      </p>
      <div className="card p-5 sm:p-7 space-y-6">
        {doc.sections.map(([heading, items]) => (
          <section key={heading}>
            <h2 className="font-bold text-slate-900 mb-2">{heading}</h2>
            <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-5">
              {items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ))}
      </div>
      <p className="text-center text-xs text-slate-400 mt-6">
        <Link to="/terms" className="hover:text-slate-600">Foydalanish shartlari</Link>
        {' · '}
        <Link to="/privacy" className="hover:text-slate-600">Maxfiylik siyosati</Link>
        {' · '}
        <Link to="/rules" className="hover:text-slate-600">Ishlash qoidalari</Link>
      </p>
    </main>
  );
}

export const TermsPage = () => <LegalPage doc={TERMS} />;
export const PrivacyPage = () => <LegalPage doc={PRIVACY} />;
