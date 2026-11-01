import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ShieldCheck, AlertTriangle } from 'lucide-react';
import { t } from '../i18n';

// DIQQAT: bu matnlar namuna. Ishga tushirishdan oldin yurist tomonidan tekshirilishi
// va [kvadrat qavs] ichidagi ma'lumotlar (kompaniya, manzil, server joylashuvi) to'ldirilishi kerak.
// Matnlar funksiya ichida: til almashganda qayta tarjima qilinadi.

const terms = () => ({
  title: t('Foydalanish shartlari'),
  icon: FileText,
  sections: [
    [t('1. Umumiy qoidalar'), [
      t('Usta24 (keyingi o\'rinlarda — Platforma) mijozlar va mustaqil ustalarni bog\'lovchi onlayn xizmatdir. Platforma egasi: [Kompaniya nomi, STIR, manzil].'),
      t('Platformadan foydalanish (ro\'yxatdan o\'tish, buyurtma berish yoki qabul qilish) ushbu shartlarga rozilik bildirishni anglatadi.'),
      t('Platforma ta\'mirlash ishlarini o\'zi bajarmaydi: ishni mustaqil usta bajaradi va ish sifati uchun usta javobgar.')
    ]],
    [t('2. Ro\'yxatdan o\'tish'), [
      t('Ro\'yxatdan o\'tish telefon raqam va SMS kod orqali amalga oshiriladi. Bitta odam bitta hisobga ega bo\'lishi kerak.'),
      t('Hisobingiz xavfsizligi uchun SMS kodni hech kimga bermang. Platforma xodimlari kodni hech qachon so\'ramaydi.')
    ]],
    [t('3. Mijozning majburiyatlari'), [
      t('Buyurtmada to\'g\'ri manzil, muammo tavsifi va aloqa ma\'lumotlarini ko\'rsatish.'),
      t('Kelishilgan ish uchun ustaga o\'z vaqtida to\'lov qilish.'),
      t('Tezkor chaqiruvni qabul qilingandan keyin asossiz bekor qilmaslik (batafsil: «Ishlash qoidalari» sahifasi).')
    ]],
    [t('4. Ustaning majburiyatlari'), [
      t('Profilda haqiqiy ma\'lumotlarni ko\'rsatish va administrator tekshiruvidan o\'tish.'),
      t('Ishni sifatli, kelishilgan muddat va narxda bajarish; ish narxini boshlashdan oldin mijoz bilan kelishish.'),
      t('Faoliyatni O\'zbekiston Respublikasi qonunchiligiga muvofiq yuritish va soliq majburiyatlarini bajarish.')
    ]],
    [t('5. Narx, to\'lov va komissiya'), [
      t('Chiqish narxi chaqiruvdan oldin ko\'rsatiladi; ish narxi usta bilan joyida kelishiladi.'),
      t('Tezkor chaqiruvlar bo\'yicha Platforma ustadan ish haqining (chiqish narxi bilan, materiallarsiz) [10]% miqdorida komissiya oladi. Usta yakuniy summani ish haqi va material bo\'yicha alohida ko\'rsatadi.')
    ]],
    [t('6. Taqiqlangan harakatlar'), [
      t('Soxta buyurtma va sharhlar, boshqa foydalanuvchilarni haqorat qilish yoki aldash, Platformani buzishga urinish.'),
      t('Qoidabuzarlik aniqlansa, hisob ogohlantirishsiz bloklanishi mumkin.')
    ]],
    [t('7. Javobgarlik va nizolar'), [
      t('Platforma foydalanuvchilar o\'rtasidagi nizolarni hal qilishda yordam beradi, lekin usta bajargan ish uchun bevosita javobgar emas.'),
      t('Nizolar muzokaralar yo\'li bilan, kelishuvga erishilmasa O\'zbekiston Respublikasi qonunchiligiga muvofiq hal qilinadi.')
    ]],
    [t('8. O\'zgartirishlar va aloqa'), [
      t('Shartlar o\'zgarganda foydalanuvchilar ilova orqali xabardor qilinadi.'),
      t('Aloqa: [telefon], [Telegram], [email].')
    ]]
  ]
});

const privacy = () => ({
  title: t('Maxfiylik siyosati'),
  icon: ShieldCheck,
  sections: [
    [t('1. Qanday ma\'lumotlar yig\'iladi'), [
      t('Telefon raqam va ism — ro\'yxatdan o\'tish va aloqa uchun.'),
      t('Buyurtma ma\'lumotlari: manzil, muammo tavsifi, yozishmalar, sharhlar.'),
      t('Joylashuv: mijozda — chaqiruv manzilini belgilashda; ustada — faqat ish rejimi yoqilganda yoki faol ish paytida.'),
      t('Rasmlar: ustaning portfoliosi va mijozning muammo rasmi. Rasmlardagi yashirin ma\'lumotlar (GPS koordinatalar, qurilma modeli) yuklanganda avtomatik o\'chiriladi.'),
      t('Telegram orqali kirsangiz yoki botni ulasangiz: Telegram ID, foydalanuvchi nomi va ism — kirish kodi va buyurtma xabarlarini yuborish uchun. Xabarlarni botda /stop bilan o\'chirish yoki profilda Telegram\'ni uzish mumkin.'),
      t('Usta tasdiqlanishi uchun: pasport (yoki ID karta) rasmi, ixtiyoriy selfi va sertifikat — faqat shaxsni tekshirish uchun.'),
      t('Murojaatlar: siz yozgan muammo tavsifi va administrator javobi.'),
      t('Texnik xatolar: sahifa manzili (so\'rov parametrlarisiz), brauzer turi va xato matni — ilovani tuzatish uchun.')
    ]],
    [t('2. Ma\'lumotlar nima uchun ishlatiladi'), [
      t('Buyurtmani eng yaqin ustaga yetkazish, mijoz va ustani bog\'lash, xizmat sifatini (reyting) ta\'minlash.'),
      t('Firibgarlik va suiiste\'molning oldini olish, qonun talablarini bajarish.'),
      t('Ma\'lumotlar reklama maqsadida uchinchi shaxslarga sotilmaydi.')
    ]],
    [t('3. Kim ko\'radi'), [
      t('Telefon raqamingiz ikkinchi tomonga faqat buyurtma qabul qilingandan keyin ko\'rsatiladi.'),
      t('Ustaning joylashuvi mijozga faqat usta yo\'lda bo\'lgan vaqtda ko\'rsatiladi.'),
      t('Buyurtmaning muammo rasmi faqat sizga, buyurtmani oladigan ustaga va administratorga ko\'rinadi (ochiq havola orqali emas).'),
      t('Ustaning hujjatlari faqat administratorga ko\'rinadi (ochiq havola orqali emas), mijozlarga ko\'rsatilmaydi.'),
      t('Administratorlar qoidabuzarlik va nizolarni ko\'rib chiqish uchun ma\'lumotlarga kira oladi; ularning amallari jurnalga yoziladi.')
    ]],
    [t('4. Saqlash va himoya'), [
      t('Ma\'lumotlar [server joylashuvi — O\'zbekiston qonunchiligi talabiga ko\'ra O\'zbekiston hududidagi server] da saqlanadi.'),
      t('Aloqa shifrlangan (HTTPS), administratorlar uchun ikki bosqichli kirish qo\'llaniladi.')
    ]],
    [t('5. Sizning huquqlaringiz'), [
      t('Ma\'lumotlaringizni ko\'rish va tuzatish: Profil sahifasida.'),
      t('Hisobni va shaxsiy ma\'lumotlarni o\'chirish: Profil → Xavfsizlik → «Hisobni o\'chirish». Hujjatlar, rasmlar va murojaatlar ham o\'chiriladi; bajarilgan buyurtmalar ikkinchi tomon tarixi uchun, ustaning komissiya hisobi esa buxgalteriya uchun ismsiz holda qoladi.'),
      t('Rozilikni qaytarib olish va savollar: [email], [telefon].')
    ]],
    [t('6. Qurilmada saqlanadigan ma\'lumotlar'), [
      t('Tizimga kirganingizni eslab qolish uchun brauzerda kirish tokeni saqlanadi. «Chiqish» yoki «Barcha qurilmalardan chiqish» uni bekor qiladi.')
    ]]
  ]
});

function LegalPage({ doc }) {
  const Icon = doc.icon;
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full flex-1">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600"><Icon className="w-6 h-6" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{doc.title}</h1>
          <p className="text-xs text-slate-500">{t('Oxirgi tahrir: {date}', { date: t('2026-yil noyabr') })}</p>
        </div>
      </div>
      <p className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        {t('Hujjat loyihasi: rasmiy ishga tushirishdan oldin yurist tomonidan tasdiqlanadi.')}
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
        <Link to="/terms" className="hover:text-slate-600">{t('Foydalanish shartlari')}</Link>
        {' · '}
        <Link to="/privacy" className="hover:text-slate-600">{t('Maxfiylik siyosati')}</Link>
        {' · '}
        <Link to="/rules" className="hover:text-slate-600">{t('Ishlash qoidalari')}</Link>
      </p>
    </main>
  );
}

export const TermsPage = () => <LegalPage doc={terms()} />;
export const PrivacyPage = () => <LegalPage doc={privacy()} />;
