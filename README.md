# 🏠 UyRemont (Usta24) — Marketplace Platformasi

Ushbu platforma uy ta'mirlash, avto, maishiy texnika va gadjet ustalarini (santexnik, elektrik, motorchi, konditsioner ustasi va boshqalar) mijozlar bilan to'g'ridan-to'g'ri bog'lovchi marketplace tizimidir.

---

## ⚡ Tezkor Ishga Tushirish (Quick Start)

### Talablar
- Node.js 18+
- PostgreSQL ma'lumotlar bazasi. O'rnatish shart emas: **Neon** (neon.tech) yoki **Supabase** dagi bepul bulutli baza ham ishlaydi.

### Ikki buyruq bilan (loyiha papkasida)
```bash
npm run setup    # paketlar, backend/.env (JWT_SECRET avtomatik), baza jadvallari va demo ma'lumotlar
npm run dev      # backend (5000) va sayt (3000) bitta oynada; to'xtatish: Ctrl + C
```
`npm run setup` faqat bitta narsani so'raydi: Neon/Supabase dagi **Connection string**. Uni joylashtiring (yoki kompyuterdagi PostgreSQL uchun Enter bosing). Skriptni qayta ishga tushirish xavfsiz — mavjud sozlamalar saqlanadi.

Qo'shimcha: `npm run setup -- --skip-install` (paketlarsiz), `npm run setup -- --no-seed` (demo ma'lumotlarsiz).

Windows da `start-dev.bat` faylini ikki marta bosish kifoya: birinchi marta sozlashni o'zi boshlaydi.

👉 Sayt: **`http://localhost:3000`**, API: **`http://localhost:5000/api`** (holat: `/api/health`)

### 📱 Telefondan sinash
```bash
npm run dev:phone
```
Terminalda **HTTPS havola va QR kod** chiqadi — telefon kamerasi bilan skanerlang. Havola istalgan internetda (mobil internet ham) ishlaydi, GPS ham ishlaydi (Cloudflare tunnel, ro'yxatdan o'tish shart emas; havola har ishga tushirishda yangilanadi). Shu Wi-Fi dagi tezroq manzil ham ko'rsatiladi, lekin u HTTPS emasligi uchun GPS ishlamaydi.

Telefonda ilova pastki navigatsiya bilan ochiladi va **«Bosh ekranga qo'shish»** orqali o'rnatiladi (PWA): Android Chrome da «O'rnatish» tugmasi chiqadi, iPhone Safari da Ulashish → «Bosh ekranga qo'shish».

Muammo bo'lsa, backend aniq sababni yozadi: baza ulanmasa (`DATABASE_URL`), jadvallar yo'q bo'lsa (`npm run db:seed`) yoki port band bo'lsa (backend boshqa oynada ishlayapti).

<details>
<summary>Qo'lda ishga tushirish (alohida terminallarda)</summary>

```bash
cd backend
npm install
cp .env.example .env     # DATABASE_URL va JWT_SECRET ni to'ldiring
npm run db:seed          # yoki faqat sxema: npm run db:setup
npm run dev
```
```bash
cd web
npm install
npm run dev
```
</details>

### Kirish (development)
Eskiz SMS sozlanmagan bo'lsa, OTP kod backend konsoliga chiqadi va kirish oynasida ko'rsatiladi.
- **Administrator:** `.env` dagi `ADMIN_PHONE` (standart: `+998900000000`)
- **Demo usta:** `+998901112233` (Jamshid Karimov, santexnik, tasdiqlangan — `/master/work` da «Ishga chiqish» tugmasini bosing)
- **Demo mijoz:** `+998931234567`

---

## 🏗️ Arxitektura

### Backend (`/backend`) — Node.js + Express + PostgreSQL + Socket.io

| Yo'l | Tavsif |
|---|---|
| `POST /api/auth/send-otp` | SMS kod yuborish (raqam bo'yicha 60 soniya oralig'i, IP bo'yicha cheklov) |
| `POST /api/auth/verify-otp` | Kodni tekshirish (5 urinish), JWT qaytaradi; yangi foydalanuvchi yaratiladi |
| `GET/PUT /api/auth/me` | Profil ma'lumotlari / ismni yangilash |
| `PUT /api/auth/set-role` | Mijoz ↔ usta rejimi |
| `GET /api/masters` | Qidiruv (`q`), bo'lim (`vertical`), mutaxassislik (`specialization`), tuman (`district`), narx (`min_rate`, `max_rate`), reyting (`min_rating`), tajriba (`min_experience`), `verified`, `available`, `has_reviews`, saralash (`sort_by`: `recommended`, `rating`, `reviews`, `experience`, `price_asc`, `price_desc`), sahifalash |
| `GET /api/masters/verticals` | Har bir bo'limdagi ustalar soni |
| `GET /api/masters/specializations` | Mutaxassisliklar katalogi (4 bo'lim) |
| `GET /api/masters/:id` | Usta profili, portfolio, sharhlar |
| `PUT /api/masters/profile` | Usta profilini tahrirlash (faqat usta) |
| `POST /api/masters/quick-start` | 1 daqiqada usta bo'lish: `{ specialization_ids, district, name? }` - rol, profil va sohalar bitta tranzaksiyada (narx, tajriba keyin) |
| `GET/POST/DELETE /api/masters/portfolio` | Portfolio rasmlari (fayl yuklash, 8 MB gacha, EXIF/GPS o'chiriladi) |
| `POST /api/orders` | Buyurtma: aniq ustaga yoki mutaxassislik bo'yicha ochiq buyurtma (`photo_ids` bilan) |
| `POST /api/orders/photos`, `DELETE /api/orders/photos/:id` | Muammo rasmi (buyurtmadan oldin yuklanadi, ko'pi bilan 3 ta) |
| `GET /api/orders/:id/photos/:photoId` | Rasm faqat mijozga, taklif olgan/biriktirilgan ustaga va adminga beriladi |
| `GET /api/orders` | Rolga mos buyurtmalar (mijoz / usta / admin) |
| `GET /api/orders/open` | Ustaning mutaxassisligiga mos ochiq buyurtmalar |
| `GET /api/orders/:id` | Tafsilot va chat tarixi (faqat ishtirokchilarga) |
| `PUT /api/orders/:id/status` | Holat o'zgarishi (quyidagi qoidalar bo'yicha). Tezkor chaqiruvni yakunlash: `labor_price` + `materials_price` |
| `POST /api/orders/:id/payment` | Mijoz tezkor chaqiruv uchun to'langan summani tasdiqlaydi: `{}` - usta yozgani to'g'ri, `{ amount }` - boshqa summa |
| `POST /api/reviews` | Yakunlangan buyurtmaga 1–5 yulduzli sharh |
| `GET /api/admin/stats` | Platforma statistikasi (faqat admin) |
| `GET /api/admin/users`, `PATCH /api/admin/users/:id` | Foydalanuvchilarni qidirish, bloklash, rol berish, ustani tasdiqlash |
| `GET /api/prices` | Taxminiy narxlar ro'yxati (ommaviy) |
| `GET/POST/PUT/DELETE /api/addresses` | Saqlangan manzillar (10 tagacha) |
| `GET /api/favorites`, `GET /api/favorites/ids`, `POST/DELETE /api/favorites/:masterId` | Sevimli ustalar |
| `GET /api/masters/u/:slug`, `GET /api/masters/u/:slug/qr` | Ustaning ommaviy sahifasi va QR kodi (`?format=svg` — chop etish uchun) |
| `GET /api/qr/ustalar` | Ustalar uchun qo'llanmaga olib boruvchi QR kod (`?format=svg`) |
| `GET /api/masters/me/commission` | Ustaning komissiya hisobi: qarz, limit, rekvizitlar, tarix |
| `GET /api/admin/commission?filter=&q=`, `GET /api/admin/commission/:masterId` | Ustalar qarzi va bitta ustaning hisobi |
| `POST /api/admin/commission/:masterId/payments`, `.../adjustments` | To'lovni qabul qilish, hisobni tuzatish (jurnalga yoziladi) |
| `GET /api/admin/commission/payment-reviews?status=`, `POST .../payment-reviews/:orderId` | To'lov farqlari: farqdan komissiya yozish (`charge`) yoki yopish (`dismiss`) |
| `GET/PUT /api/masters/me/link` | Ustaning o'z havolasi (nomini o'zgartirish) |
| `GET/POST/PUT/DELETE /api/admin/prices`, `PUT /api/admin/specializations/:id/call-fee` | Narxlar va chiqish narxlarini tahrirlash (jurnalga yoziladi) |
| `GET /api/support/contacts`, `POST /api/support`, `GET /api/support/my` | Qo'llab-quvvatlash kontaktlari, murojaat yoki shikoyat yuborish (`order_id` yoki `target_user_id` bilan), o'z murojaatlari va ogohlantirishlari |
| `GET/POST /api/masters/me/verification`, `POST/GET/DELETE /api/masters/me/documents` | Ustaning tasdiqlash holati, hujjat yuklash va tekshiruvga yuborish |
| `GET /api/admin/support?kind=complaint`, `PUT /api/admin/support/:id` | Murojaatlar navbati (yoki faqat shikoyatlar), holat va javob |
| `POST /api/admin/users/:id/warnings` | Shikoyat qilingan foydalanuvchiga ogohlantirish (saytda, Telegram'da va «Yordam» sahifasida) |
| `GET /api/admin/verifications`, `POST /api/admin/verifications/:userId/approve\|reject`, `GET /api/admin/documents/:id` | Ustalarni tekshirish navbati va hujjatlar |
| `GET /api/admin/analytics?days=`, `GET /api/admin/queues` | MVP ko'rsatkichlari, navbatlardagi ishlar soni |
| `POST /api/client-errors`, `GET /api/admin/errors`, `POST /api/admin/errors/:id/resolve` | Saytdagi xatolarni yig'ish va ko'rish |

**Buyurtma holatlari:**
`pending → accepted → in_progress → completed`, `pending/accepted → cancelled`.
Qabul qilish va ishni boshlash — usta; bekor qilish — mijoz yoki usta; yakunlash — usta yoki mijoz.
Ochiq buyurtmani birinchi qabul qilgan usta unga biriktiriladi (bir vaqtdagi so'rovlardan himoyalangan).
Telefon raqamlar faqat buyurtma qabul qilingandan keyin tomonlarga ko'rinadi.

**Real-time chat (Socket.io):** `join_order_chat`, `send_message`, `new_message`, `order_updated`. Har bir xabarda foydalanuvchi buyurtma ishtirokchisi ekanligi tekshiriladi.

**Xavfsizlik:** helmet, CORS (`CLIENT_URL`), so'rovlar chastotasi cheklovi, kiruvchi ma'lumotlarni tekshirish, parametrlangan SQL, bloklangan foydalanuvchi tokeni va socket ulanishi bekor qilinadi.

### Web Frontend (`/web`) — React + Vite + Tailwind CSS + React Router
- **Katalog (bosh sahifa):** katta qidiruv va bitta asosiy tugma ("Usta chaqirish"), "Xizmatlar" bloki (4 bo'lim va soha plitkalari), ixcham usta kartochkalari.
  - **Filtrlar:** tuman, boshlang'ich narx oralig'i, reyting (4+ / 4.5+), tajriba (3+ / 5+ / 10+), faqat tasdiqlangan, hozir bo'sh, sharhi bor. Kompyuterda chap panelda (darhol qo'llanadi), telefonda "Filtrlar" oynasida (tugmada mos ustalar soni ko'rinadi).
  - Tanlangan filtrlar chip ko'rinishida (× bilan olib tashlanadi), "N ta usta topildi", bo'sh natijada "Filtrlarni tozalash".
  - **Saralash:** "Tavsiya etilgan" (standart) - bo'sh va tasdiqlangan ustalar oldinda, reyting sharhlar soni bilan tortiladi (1 ta 5.0 sharh 50 ta 4.9 sharhdan yuqori chiqmaydi), shuningdek reyting, sharhlar, tajriba, narx bo'yicha.
  - Qidiruvda soha tanlanmagan bo'lsa, hamma bo'limlar bo'yicha qidiriladi. Barcha tanlovlar URL da saqlanadi (havolani ulashish mumkin).
- **Telefon + SMS kod orqali kirish**, yangi foydalanuvchidan ism so'raladi.
- **Usta profili:** portfolio, sharhlar, bajarilgan buyurtmalar soni. Telefon raqami buyurtma qabul qilingach ochiladi.
- **1 daqiqada usta bo'lish (`/usta-bolish`):** 3 qadam - soha (bir nechta), tuman, telefon raqamni tasdiqlash (kirish oynasi oxirida ochiladi). Tanlov sahifa yangilansa ham saqlanadi. Shu zahoti katalogga qo'shiladi, tabrik sahifasida keyingi qadamlar: Telegram'ni ulash, hujjat yuborish, narx, tajriba va ish rasmlarini qo'shish.
  - Hamma "usta bo'lish" tugmalari (sarlavha menyusi, bosh sahifa, `/ustalar`, onboarding, profil) shu sahifaga olib boradi. `/master/setup` usta bo'lmaganlarni ham shu yerga yo'naltiradi.
  - Usta profilida **«Profilni to'ldiring»** ro'yxati va foiz ko'rsatkichi bor: narx, tajriba, o'zi haqida (30+ belgi), 3+ ish rasmi, hujjatlar, Telegram. Hammasi bajarilsa ro'yxat yo'qoladi.
  - Narx va tajriba ixtiyoriy: bo'sh bo'lsa katalogda «Narx kelishiladi» va «Yangi usta» ko'rinadi.
- **Buyurtma berish:** aniq ustaga yoki "Usta tanlamasdan buyurtma qoldirish", Telegram orqali ulashish.
- **Buyurtmalarim:** holat filtrlari, buyurtma sahifasida holat bosqichlari, amallar, real-time chat va sharh qoldirish.
- **Usta kabineti:** profil yaratish/tahrirlash, mutaxassisliklar, "Band/Bo'sh" holati, portfolio yuklash, ochiq buyurtmalarni olish.
- **Admin panel** (`/admin`): MVP ko'rsatkichlari va grafiklar, foydalanuvchilar, ustalarni tekshirish navbati, buyurtmalar, murojaatlar, narxlar, jurnal, xatolar (navbatdagi ishlar soni tab yonida qizil belgida).
- **Smart smeta kalkulyatori** — tanlangan xizmat bo'yicha ustalar ro'yxatiga o'tadi.
- **Taxminiy narxlar** (`/prices`): soha bo'yicha ish haqi oralig'i, qidiruv, admin panelda tahrirlanadi.
- **Muammo rasmi:** mijoz chaqiruvga 3 tagacha rasm qo'shadi (telefonda kichraytiriladi), usta taklifda oldindan ko'radi.
- **Tanishtiruv:** birinchi ochilishda 3 ta ekran (o'tkazib yuborish mumkin, «Qoidalar» va profildan qayta ochiladi).
- **Tungi rejim:** telefon sozlamasi bo'yicha yoki profilda tanlanadi.
- **Saqlangan manzillar** ("Uy", "Ish"): usta chaqirishda bir bosishda tanlanadi, chaqiruvda «Bu manzilni saqlash» bilan qo'shiladi, profilda tahrirlanadi.
- **Sevimli ustalar:** kartochkadagi yurakcha, `/favorites` sahifasi, bosh sahifada sevimlilar qatori; tezkor chaqiruvda sevimli usta qidiruv radiusida bo'lsa taklif birinchi unga boradi.
- **"Yana chaqirish":** yakunlangan/bekor qilingan buyurtmadan xizmat turi va manzil bilan qayta chaqirish yoki o'sha ustaga qayta buyurtma.
- **Ustaning ommaviy havolasi** (`/u/<nom>`): usta uni Telegram'da ulashadi, QR kodni chop etadi; havola nomini o'zgartirish mumkin.
- **Ustalar uchun qo'llanma** (`/ustalar`):
  - nega Usta24, qanday boshlash (5 qadam);
  - tezkor chaqiruv qoidalari (raqamlar serverdagi sozlamadan), maslahatlar, savol-javob, yordam kontaktlari;
  - Telegram guruhlarda ulashilganda o'z kartochkasi bilan ko'rinadi.
- **Chop etiladigan varaqalar** (A4, printerda aniq o'lchamda, tungi rejimda ham oq):
  - `/ustalar/varaqa` — usta jalb qilish varaqasi: QR kod qo'llanmaga olib boradi, pastida 7 ta yirtib olinadigan qirqim. Admin → «Ustalar» bo'limida havola bor.
  - `/master/varaqa` — ustaning shaxsiy varaqasi yoki 10 ta vizitka (85×55 mm). QR kod ustaning `/u/<nom>` sahifasiga olib boradi.
  - Sayt vaqtinchalik manzilda bo'lsa (localhost, tunnel), chop etishdan oldin ogohlantiriladi.
- **Murojaatlar markazi** (`/support`): kontaktlar, «Murojaatlarim» ro'yxati; buyurtma sahifasida «Muammo haqida xabar berish».
- **Ustani tasdiqlash:** usta profil sahifasida pasport rasmini yuklab tekshiruvga yuboradi, natija sahifani yangilamasdan keladi.

**Dizayn tizimi:** ranglar `web/tailwind.config.js` da CSS o'zgaruvchilari orqali beriladi va qorong'i rejimda o'zi almashadi (`bg-white`, `text-slate-900` kabi klasslar ikkala rejimda ishlaydi, `dark:` yozish shart emas). Har doim oq/to'q qoladigan joylar uchun `snow` va `ink` ranglari. Umumiy klasslar `web/src/index.css` da: `btn` (+ `btn-primary`, `btn-accent`, `btn-secondary`, `btn-danger`, `btn-success`, `btn-dark`, `btn-soft`, `btn-ghost`, `btn-sm`, `btn-lg`), `icon-btn`, `card`, `card-pad`, `input`, `label`, `hint`, `chip`, `chip-active`, `link`. Tugmalar balandligi kamida 44px.

---

## ⚡ Tezkor chaqiruv (taksi rejimi)

Yandex Taxi kabi ishlaydi: mijoz usta chaqiradi, tizim eng yaqin bo'sh ustani o'zi topadi.

**Mijoz:** `/call` — xizmat turi → xaritada manzil (GPS yoki qo'lda) → muammo tavsifi va rasmi → chiqish narxi, bo'sh ustalar soni va taxminiy yetib kelish vaqti → «Usta chaqirish». Keyin buyurtma sahifasida jonli holat: *Qidiruv → Usta yo'lda (xaritada jonli) → Yetib keldi → Ish → Yakun*.

**Usta:** `/master/work` — «Ishga chiqish» tugmasi, bugungi daromad/komissiya/reyting/qabul qilish foizi. Ish rejimida joylashuv har 15 soniyada yuboriladi; taklif kelganda signal va taymerli oyna chiqadi (Qabul qilish / Rad etish). Faol ishda: Navigator, «Yetib keldim», «Ishni boshlash», «Yakunlash» (yakuniy summa bilan), mijozni baholash.

**Qoidalar** (server tomonda majburiy, `/rules` sahifasida ko'rsatiladi, `backend/src/config/dispatch.js`):

| Qoida | Qiymat |
|---|---|
| Taklif eng yaqin ustaga ketma-ket yuboriladi, javob vaqti | 20 soniya (`DISPATCH_OFFER_TIMEOUT_SEC`) |
| Qidiruv radiusi bosqichma-bosqich kengayadi | 3 → 7 → 15 km |
| Usta topilmasa chaqiruv yopiladi | 5 daqiqa (`DISPATCH_SEARCH_TIMEOUT_MIN`) |
| Ketma-ket javobsiz takliflar → ish rejimi avtomatik o'chadi | 3 ta |
| Mijozda bir vaqtda faol chaqiruv | 1 ta |
| Qabuldan keyin bepul bekor qilish | 3 daqiqa (keyin «kech bekor qilish» qayd etiladi) |
| Ish boshlangandan keyin mijoz bekor qila olmaydi | — |
| Usta voz kechsa chaqiruv qayta qidiruvga qaytadi | o'sha ustaga qayta taklif qilinmaydi |
| Ishga chiqish: tasdiqlangan profil, mutaxassislik, reyting ≥ 4.0 | `DISPATCH_REQUIRE_VERIFIED` |
| Joylashuvi eskirgan ustaga taklif yuborilmaydi | 10 daqiqa |
| Platforma komissiyasi | 10% (`PLATFORM_COMMISSION_PERCENT`) |
| Ikki tomonlama reyting | mijoz ↔ usta |

**API:** `GET /api/dispatch/config`, `GET /api/dispatch/estimate`, `POST /api/dispatch/orders`, `GET /api/dispatch/active`, `POST /api/dispatch/orders/:id/cancel`, `GET /api/dispatch/me`, `PUT /api/dispatch/online`, `PUT /api/dispatch/location`, `POST /api/dispatch/offers/:id/accept|decline`, `POST /api/dispatch/orders/:id/rate-client`. Bosqichlar `PUT /api/orders/:id/status` (`arrived`, `in_progress`, `completed` + `labor_price` va `materials_price`).

**Socket hodisalari:** `order_offer`, `offer_closed`, `dispatch_offline` (usta), `search_update`, `master_location`, `order_updated` (mijoz). Dispetcher holatni bazada (`dispatch_offers`) saqlaydi, shuning uchun server qayta ishga tushsa ham qidiruv davom etadi; bir nechta server nusxasida PostgreSQL advisory lock bilan faqat bittasi dispetcherlik qiladi.

Xarita: Leaflet + OpenStreetMap (kalit talab qilinmaydi). Katta yuklama uchun o'z tile serveringiz yoki Yandex/Google xaritalariga o'tish tavsiya etiladi.

---

## 🛟 Murojaatlar, ustani tasdiqlash, statistika

**Murojaatlar markazi.** Mijoz yoki usta buyurtma sahifasidagi «Muammo haqida xabar berish» tugmasi yoki `/support` sahifasi orqali yozadi. Turlar rolga qarab: usta kelmadi, narx bo'yicha kelishmovchilik, ish sifati, mijoz to'lamadi, xulq-atvor, ilovadagi muammo, boshqa. Buyurtmaga oid turlar faqat o'sha buyurtma ishtirokchisidan qabul qilinadi. Cheklov: 5 ta ochiq va kuniga 10 ta murojaat. Administrator «Murojaatlar» bo'limida holatni o'zgartiradi va javob yozadi. Javob foydalanuvchiga darhol saytda, ulangan bo'lsa Telegram'da ham keladi. Kontaktlar `SUPPORT_PHONE` va `SUPPORT_TELEGRAM` dan olinadi.

**Shikoyatlar.** Shikoyat - kimgadir qarshi murojaat (`support_tickets.target_user_id`), shu sababli hamma shikoyat bitta odam bo'yicha yig'iladi.
- **Usta profilidan (buyurtmasiz).** Profil oynasi va `/u/:slug` pastida «Shikoyat qilish» tugmasi bor. Sabablar:
  - soxta profil yoki boshqa odamning rasmi;
  - noto'g'ri ma'lumot;
  - nomaqbul rasm yoki matn;
  - saytdan tashqari to'lov yoki raqam so'radi;
  - firibgarlik;
  - boshqa.

  Izoh ixtiyoriy («Boshqa» uchun majburiy). Usta kim shikoyat qilganini bilmaydi.
- **Buyurtma bo'yicha.** «Muammo haqida xabar berish» oynasidagi shikoyat turlari avtomatik ravishda buyurtmaning ikkinchi tomoniga qarshi yoziladi. «Saytdan tashqari to'lov» va «Firibgarlik» turlari ham qo'shildi.
- Bitta odamga ochiq shikoyat faqat bitta bo'ladi (takrori 409). Kunlik va ochiq murojaatlar cheklovi umumiy.
- **Admin → «Murojaatlar» → «Faqat shikoyatlar».**
  - Har bir shikoyatda kimga qarshi ekani (telefon bilan) ko'rinadi.
  - Unga qarshi jami shikoyatlar soni va necha kishidan kelgani (3 va undan ko'p kishi bo'lsa qizil), ogohlantirishlar soni ham chiqadi.
  - **Ogohlantirish** tugmasi sababga mos tayyor matnni taklif qiladi. Ogohlantirish `user_warnings` jadvaliga yoziladi, foydalanuvchiga saytda, Telegram'da va «Yordam» sahifasida ko'rinadi.
  - **Bloklash / Blokdan chiqarish:** bloklangan usta katalogda ko'rinmaydi va taklif olmaydi.
  - Har bir amal jurnalga yoziladi.

**Ustani tasdiqlash.** Usta profil sahifasining (`/master/profile`) yuqorisidagi tasdiqlash bo'limida pasport yoki ID karta rasmini (majburiy), selfi va sertifikatni (ixtiyoriy) yuklaydi va tekshiruvga yuboradi. Ism, kamida bitta mutaxassislik va pasport talab qilinadi. Hujjatlar ochiq papkada emas: `MASTER_DOC_DIR` da saqlanadi, faqat ustaning o'ziga va administratorga beriladi, EXIF/GPS o'chiriladi, hisob o'chirilganda fayllar ham o'chiriladi. Administrator «Ustalar» bo'limida hujjatlarni ko'rib tasdiqlaydi yoki sabab yozib rad etadi (jurnalga yoziladi). Tasdiqlangan usta darhol tezkor chaqiruv ola boshlaydi.

**MVP ko'rsatkichlari** (Admin → Statistika, 7/14/30/90 kun):
- usta topilish darajasi (tezkor chaqiruvlarning necha foizida usta topildi; 70% dan past bo'lsa ogohlantirish);
- usta topilish va yetib kelish vaqtining medianasi;
- yakunlangan ishlar, aylanma va komissiya, qayta buyurtma bergan mijozlar, bekor qilishlar (kech bekor qilish bilan), ochiq murojaatlar;
- kunlik buyurtmalar (tezkor/oddiy) va Toshkent vaqti bo'yicha soatlik talab grafiklari, har birida «Jadval» ko'rinishi;
- sohalar bo'yicha talab va tasdiqlangan ustalar soni (3 tadan kam bo'lsa ⚠).

**Xatolarni kuzatish.** Serverdagi 5xx xatolar va brauzerdagi JavaScript xatolari (`window.onerror`, `unhandledrejection`, React ErrorBoundary) `error_logs` jadvaliga bir xil xatolar birlashtirilib yoziladi (soni va oxirgi vaqti bilan). Admin → «Xatolar» bo'limida ko'riladi va «Hal qilindi» deb belgilanadi; xato qaytalansa yana ochiladi. Sahifa manzili so'rov parametrlarisiz saqlanadi (tokenlar va telefon raqamlar logga tushmaydi).

---

## 💳 Komissiya hisobi (qo'lda yig'ish)

Mijoz ish haqini ustaga to'g'ridan-to'g'ri to'laydi, usta esa platformaga komissiya qarzdor bo'ladi.

- **Ish haqi va material:** usta ishni yakunlaganda ikki summa kiritadi: «Ish haqi (chiqish narxi bilan)» va «Material» (o'zi sotib olgan qismlar). Bu tezkor chaqiruvga ham, oddiy buyurtmaga ham tegishli. Yakuniy summa = ish haqi + material. Mijoz ikkalasini alohida ko'radi: saytda va Telegram xabarida.
- **Yozilishi:** ustaning hisobiga **ish haqidan** foiz yoziladi:
  - tezkor chaqiruvda `PLATFORM_COMMISSION_PERCENT`;
  - oddiy (katalog) buyurtmada `CATALOG_COMMISSION_PERCENT` (berilmasa, `PLATFORM_COMMISSION_PERCENT` bilan bir xil; `0` — olinmaydi).

  Materialdan komissiya olinmaydi. Eski ilova faqat `final_price` yuborsa, u ish haqi hisoblanadi. Foiz yozilgan paytdagisi saqlanadi, bitta buyurtmaga bir marta yoziladi.
- **Oddiy buyurtmani mijoz yakunlasa** (yoki admin), komissiya darhol yozilmaydi.
  - Usta yakuniy summani `PRICE_ENTRY_HOURS` (standart 24) soat ichida kiritadi (`orders.price_due_at`, `PUT /api/orders/:id/final-price`).
  - Ustaga saytda «Yakuniy summani kiriting» kartasi va ro'yxatda belgi chiqadi, Telegram'da «💰 Summani kiritish» tugmasi keladi.
  - Muddat o'tsa, usta yangi oddiy buyurtmani qabul qila olmaydi va ishga chiqa olmaydi, toki summani kiritmaguncha.
  - Summa kiritilgach komissiya yoziladi va mijozdan to'lovni tasdiqlash so'raladi.
  - Bu yangilanishdan oldin yakunlangan (muddatsiz) buyurtmalar hisobga olinmaydi.
- **Qarz limiti** (`COMMISSION_DEBT_LIMIT`, sukut bo'yicha 200 000 so'm; `0` — cheklov yo'q):
  - qarz limitdan oshsa, ish rejimi o'chadi va usta to'lamaguncha ishga chiqa olmaydi va yangi oddiy buyurtmani qabul qila olmaydi;
  - bunday ustaga dispetcher taklif yubormaydi;
  - limitning 80% iga yetganda ogohlantirish keladi.
- **Usta:**
  - «Ish rejimi» sahifasida qarz kartasi;
  - **Komissiya hisobi** sahifasi (`/master/hisob`): qarz, limit, to'lov rekvizitlari (`COMMISSION_PAYMENT_INFO`) va tarix.
  - O'zgarish sahifani yangilamasdan va Telegram'da keladi.
- **Admin → «Komissiya»:**
  - jami qarz, limitdan oshganlar, 30 kunda yozilgan va yig'ilgan summa;
  - qarzdorlar ro'yxati, ism yoki telefon bo'yicha qidiruv;
  - **To'lov qabul qilish:** karta, naqd, bank o'tkazmasi yoki boshqa usul;
  - **Tuzatish:** chegirma yoki xato yozuvni qaytarish, sabab majburiy;
  - ustaning to'liq tarixi.
  - Har bir amal jurnalga yoziladi, limitdan oshgan ustalar soni tab yonida qizil belgida ko'rinadi.
- **Hisobning tuzilishi:** `master_ledger` jadvalida har bir yozuv qarzga ta'sirini saqlaydi: komissiya `+`, to'lov `−`, tuzatish `±`. `master_profiles.commission_due` shu yig'indining tezkor nusxasi va har doim bitta tranzaksiyada yangilanadi.

### 🔒 Komissiyani chetlab o'tishga qarshi

**Telefon raqamlar buyurtma qabul qilinmaguncha ko'rinmaydi.**
- Usta profilida (katalog, profil oynasi, `/u/:slug`, sevimlilar) raqam yo'q: API uni qaytarmaydi. Raqamlar usta buyurtmani qabul qilgach buyurtma sahifasida ikki tomonga ham ko'rinadi.
- Matnga yozilgan raqam va Telegram manzili (`90 123 45 67`, `+998...`, `@username`, `t.me/...`):
  - usta bio va portfolio izohida, buyurtma sarlavhasi, tavsifi va manzilida qabul qilinmaydi (400, tushunarli xabar bilan);
  - avval saqlanganlari ommaviy javoblarda `•••` bilan yashiriladi;
  - qabul qilinmagan buyurtma chatida xabardagi raqam `•••` bilan almashtiriladi va yuboruvchiga sababi aytiladi.
- Aniqlash: 9–13 raqamli ketma-ketlik telefon hisoblanadi. Yillar (`2015-2023`) va minglik guruhli summalar (`1 200 000`, `150 000 000`) telefon hisoblanmaydi (`src/utils/contacts.js`).

**Mijoz to'langan summani tasdiqlaydi** (tezkor chaqiruv yakunlangach).
- Buyurtma sahifasida «To'lovni tasdiqlang» kartasi chiqadi: «Ha, 250 000 so'm to'ladim» yoki «Yo'q, boshqa summa».
- Telegram'dagi yakunlanish xabarida ham «✅ Ha, ... to'ladim» tugmasi bor. «Boshqa summa» tugmasi summa maydonini ochib beradi.
- Mijozning javobi ustaga ko'rsatilmaydi. Summa mos kelsa, ustaga faqat «Mijoz to'lovni tasdiqladi» belgisi chiqadi.
- Usta yakunlash oynasida «Mijozdan ham to'langan summani tasdiqlash so'raladi» degan ogohlantirishni ko'radi.
- **Farq:** mijoz aytgan summa ustaning yozganidan ko'p bo'lsa (yaxlitlash hisobga olinmaydi: farq 5 000 so'mdan va 5 foizdan katta bo'lishi kerak), buyurtma **Admin → Komissiya → «To'lov farqlari»** ga tushadi.
  - Ro'yxatda ikki tomonning telefoni va taklif qilingan komissiya ko'rinadi (komissiya yozilgan paytdagi foiz bilan farqdan hisoblanadi).
  - Admin ikki tomon bilan gaplashib, farqdan komissiya yozadi (ustaning hisobiga tuzatish, buyurtmaga bog'langan) yoki farqni yopadi.
  - Har bir qaror jurnalga yoziladi, tekshirilmagan farqlar soni «Komissiya» tab belgisiga qo'shiladi.

---

## 🧪 Avtomatik testlar

Testlar **alohida** PostgreSQL bazada ishlaydi (asosiy bazaga tegmaydi; `TEST_DATABASE_URL` `backend/.env` dagi `DATABASE_URL` bilan bir xil bo'lsa testlar to'xtaydi).

```bash
# bir marta: test bazasini yaratish (kompyuterdagi PostgreSQL)
createdb uyremont_test

cd backend
TEST_DATABASE_URL=postgresql://postgres:PAROL@localhost:5432/uyremont_test npm test   # 100 test, ~20 soniya
cd ../web && npm test && npm run build
```

Windows PowerShell'da: `$env:TEST_DATABASE_URL="postgresql://..."; npm test`.

- `backend/tests/` — kirish va xavfsizlik (OTP, 2FA, bloklash, hisobni o'chirish), buyurtma rasmlari va narxlar, tezkor chaqiruv (sevimli usta ustunligi bilan), Telegram bot (soxta Telegram API bilan), manzillar, sevimlilar, ommaviy havola, murojaatlar, ustani tasdiqlash va hujjatlar, statistika, xatolar jurnali, havola ko'rinishi (Open Graph), komissiya hisobi.
- **GitHub Actions** (`.github/workflows/ci.yml`): har bir push'da avtomatik:
  - testlar PostgreSQL bilan ishlaydi;
  - `npm audit` (yuqori daraja) va sayt build'i tekshiriladi;
  - production Docker imijlari yig'iladi, `Caddyfile` va `docker-compose.yml` tekshiriladi. Natija commit va PR yonida ✅/❌ bo'lib ko'rinadi.

---

## 🤖 Telegram bot

SMS o'rniga bepul kirish kodi, ustaga takliflar (ilova yopiq bo'lsa ham) va mijozga buyurtma bosqichlari haqida xabarlar.

**Ulash (5 daqiqa):**
1. Telegram'da [@BotFather](https://t.me/BotFather) → `/newbot` → bot nomi va `..._bot` bilan tugaydigan username → token beriladi.
2. Loyiha papkasida: `npm run setup -- --skip-install --telegram=TOKEN` (yoki `backend/.env` ga `TELEGRAM_BOT_TOKEN=...`).
3. Backendni qayta ishga tushiring — konsolda `🤖 Telegram bot @..._bot ishlayapti (polling)` chiqadi.

**Qanday ishlaydi:**
- **Kirish:** kirish oynasida «Telegram orqali kod olish» → botda «Start» → «📱 Raqamni yuborish». Bot faqat foydalanuvchining **o'z** raqamini qabul qiladi va u saytda kiritilgan raqamga mos kelishi shart. Kod odatdagidek `/api/auth/verify-otp` da tasdiqlanadi (SMS bilan bir xil limitlar: 60 soniya oralig'i, 5 urinish, kunlik limit). Keyingi safar kod darhol Telegram'ga keladi.
- **Usta:** yangi taklif Telegram'ga «✅ Qabul qilish / ❌ Rad etish» tugmalari bilan keladi; taklif yopilganda xabar yangilanadi (muddati tugadi / qabul qilindi + «Yo'l ko'rsatish»).
- **Mijoz:** usta topildi, yetib keldi, ish boshlandi, yakunlandi (summa bilan), bekor qilindi, usta topilmadi.
- **Chat:** qabul qiluvchi saytda bo'lmasa xabar Telegram'ga keladi (bir buyurtma uchun 2 daqiqada bir marta).
- Profil → **Telegram**: ulash, xabarlarni o'chirish/yoqish, uzish. Botda `/stop` — xabarlarni o'chirish, `/start` — yoqish.

**Production:** bir nechta server nusxasi bo'lsa `TELEGRAM_WEBHOOK_URL=https://api.domen.uz/api/telegram/webhook` qo'ying (so'rovlar maxfiy sarlavha bilan tekshiriladi), xabarlardagi havolalar uchun `PUBLIC_APP_URL=https://domen.uz`. Telegram tugmalarida `localhost` manzillari ishlamaydi, shuning uchun development'da havola tugmalari ko'rsatilmaydi.

**API:** `GET /api/auth/telegram/config`, `POST /api/auth/telegram/start`, `GET /api/auth/telegram/requests/:id`, `GET/PUT/DELETE /api/auth/telegram`, `POST /api/auth/telegram/link`, `POST /api/telegram/webhook`.

---

## 🌐 Til / Язык

Sayt va server o'zbek (lotin) va rus tillarida ishlaydi. Til almashtirgich (UZ | RU) sarlavhada va profil sahifasida turadi, tanlov brauzerda va hisobda saqlanadi. Admin panel faqat o'zbekcha.

- **Sayt:** matnlar kodda o'zbekcha yoziladi va `t('...')` ga o'raladi. Ruscha tarjimalar `web/src/i18n/ru/*.js` da. Qoidalar va atamalar lug'ati: `web/src/i18n/README.md`. `npm test` (web) koddagi har bir `t()` matnining tarjimasi borligini tekshiradi.
- **Bazadagi nomlar:** mutaxassisliklar — `specializations.name_ru`; narxlar ro'yxatidagi ishlar — `price_items.name_ru` (standart ishlar tarjima qilingan, yangilarini admin «Narxlar» bo'limida yozadi).
- **Server:** matnlar kodda o'zbekcha yoziladi, o'zbekcha matnning o'zi kalit. Ruscha tarjimasi `backend/src/i18n/ru.js` da (qoidalar: `backend/src/i18n/index.js`).

- **API javoblari:** sayt har so'rovda `Accept-Language: uz|ru` yuboradi. `backend/src/middleware/language.js` `res.json` ni o'raydi va javobdagi faqat `message` maydonini tarjima qiladi (xatolar, `errorHandler`, avtorizatsiya, so'rovlar cheklovi ham). Sarlavha bo'lmasa yoki tanilmasa — kirgan foydalanuvchining saqlangan tili, aks holda o'zbekcha. Ma'lumotlar (`data`) tarjima qilinmaydi.
- **Foydalanuvchi tili:** `users.language` (`uz` | `ru`, sukut bo'yicha `uz`; ruscha saytda ro'yxatdan o'tganda `ru`). Til almashtirilganda sayt `PUT /api/auth/me { language }` yuboradi, `GET /api/auth/me` uni qaytaradi.
- **Server o'zi yuboradigan xabarlar** shu tilda: Telegram bildirishnomalari va bot javoblari (hisobi yo'q foydalanuvchiga — Telegram ilovasi tilida), socket xabarlari (`commission_updated.message`, `dispatch_offline.reason`, `order_updated.message` — har bir ulanish `lang_uz`/`lang_ru` xonasida). Tezkor chaqiruv sarlavhasida mutaxassislik `specializations.name_ru` bilan ko'rsatiladi.
- **Yangi matn qo'shganda:** o'zbekcha matnni kodga yozing va tarjimasini `ru.js` ga qo'shing. O'zgaruvchili matnlar andoza bilan: `'{field} majburiy': 'Заполните поле «{field}»'` (`{n:num}` — son, `{x:raw}` — tarjima qilinmaydi, `{x:list}` — ro'yxat). Telegram matnlari `tr(lang, 'andoza {name}', { name: escapeHtml(...) })` bilan yoziladi. `tests/i18n.test.js` koddagi har bir xabar, maydon nomi va `tr()` andozasining tarjimasi borligini tekshiradi.
- O'zbekcha qoladi: SMS kodi matni (Eskiz'da tasdiqlangan andoza) va ustaning havola kartochkasi (`/u/:slug`, `/ustalar` — Telegram/WhatsApp ko'rinishi uchun serverda yoziladigan HTML).
- Mavjud bazada ustunni qo'shish: `cd backend && npm run db:setup` (sxema qayta ishga tushirilsa xavfsiz).

---

## ⚙️ Muhit o'zgaruvchilari

`backend/.env` (namuna: `backend/.env.example`):

| O'zgaruvchi | Tavsif |
|---|---|
| `DATABASE_URL` | PostgreSQL ulanish qatori |
| `DATABASE_SSL` | Ixtiyoriy: `true`/`false` (Supabase/Neon uchun avtomatik yoqiladi) |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Token imzosi va muddati |
| `CLIENT_URL` | Frontend manzili (CORS), vergul bilan bir nechta |
| `ADMIN_PHONE`, `ADMIN_NAME` | `db:setup` paytida administrator qilinadigan raqam |
| `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_FROM` | Eskiz.uz SMS (bo'sh bo'lsa kod faqat `OTP_DEV_MODE=true` da ko'rinadi) |
| `UPLOAD_DIR` | Portfolio rasmlari papkasi (standart: `backend/uploads`) |
| `ORDER_PHOTO_DIR` | Buyurtma rasmlari, ochiq emas (standart: `backend/private_uploads/orders`) |
| `MASTER_DOC_DIR` | Ustalarning hujjatlari, ochiq emas (standart: `backend/private_uploads/documents`) |
| `WEB_INDEX_HTML` | `/u/<usta>` sahifasi uchun saytning build qilingan `index.html` i (standart: `web/dist/index.html`) |
| `SUPPORT_PHONE`, `SUPPORT_TELEGRAM` | `/support` sahifasidagi kontaktlar (masalan `+998 71 200 00 00` va `usta24_yordam`) |
| `TELEGRAM_BOT_TOKEN` | @BotFather tokeni (bo'sh bo'lsa Telegram o'chiq) |
| `PUBLIC_APP_URL` | Telegram xabarlaridagi havolalar uchun sayt manzili |
| `TELEGRAM_WEBHOOK_URL` | Production webhook (bo'sh bo'lsa long polling) |
| `PLATFORM_COMMISSION_PERCENT` | Tezkor chaqiruv komissiyasi, ish haqidan % (standart: 10) |
| `CATALOG_COMMISSION_PERCENT` | Oddiy (katalog) buyurtma komissiyasi, % (standart: `PLATFORM_COMMISSION_PERCENT` bilan bir xil; `0` — olinmaydi) |
| `PRICE_ENTRY_HOURS` | Mijoz yakunlagan oddiy buyurtmaning summasini usta kiritadigan muddat, soat (standart: 24) |
| `COMMISSION_DEBT_LIMIT` | Komissiya qarzi limiti, so'm (standart: 200 000; `0` — cheklov yo'q) |
| `COMMISSION_PAYMENT_INFO` | Ustalarga ko'rsatiladigan to'lov rekvizitlari |
| `DISPATCH_OFFER_TIMEOUT_SEC`, `DISPATCH_SEARCH_TIMEOUT_MIN` | Taklif va qidiruv vaqtlari |
| `DISPATCH_REQUIRE_VERIFIED` | `false` bo'lsa tasdiqlanmagan ustalar ham tezkor chaqiruv oladi |

`web/.env` (production): `VITE_BACKEND_URL=https://api.sizning-domen.uz`

---

## 🚀 Production (serverga joylash)

Bitta buyruq bilan Ubuntu serverda: Docker, avtomatik HTTPS (Caddy + Let's Encrypt), PostgreSQL va kunlik zaxira nusxalar.

```bash
git clone https://github.com/ElshodDev/UyRemont.git usta24 && cd usta24/deploy
sudo ./usta24.sh install     # domen, admin raqami, SMS/Telegram so'raladi; kalitlar avtomatik
```

Batafsil qo'llanma: **[deploy/README.md](deploy/README.md)**. Unda server talablari, DNS, boshqaruv (`status`, `logs`, `update`), zaxira va tiklash (`backup`, `restore`) yozilgan.

| Fayl | Vazifasi |
|---|---|
| `Dockerfile` | Uchta bosqich: sayt build'i, `backend` imiji (shriftlar bilan, root bo'lmagan foydalanuvchi), `web` imiji (Caddy + sayt fayllari) |
| `deploy/docker-compose.yml` | `db`, `backend`, `web`, `backup` xizmatlari, healthcheck, log hajmi cheklovi |
| `deploy/Caddyfile` | HTTPS, `http → https`, CSP/HSTS va boshqa sarlavhalar, `/api` `/socket.io` `/uploads` `/u/*` `/ustalar` → backend, keshlash |
| `deploy/backup.sh` | Kunlik `pg_dump` + rasmlar arxivi, tekshiruv, 14 kun / 8 hafta saqlash, tiklash |
| `deploy/usta24.sh` | `install`, `update`, `restart`, `status`, `logs`, `backup`, `backups`, `restore`, `stop` |

Docker'siz ishga tushirish ham mumkin (`cd web && npm run build`, `cd backend && NODE_ENV=production npm start`). Bunda oldiga HTTPS beruvchi proksi qo'yiladi va `deploy/Caddyfile` dagi sozlamalar takrorlanadi.

Production rejimida (`NODE_ENV=production`):
- kirish kodi javobda qaytarilmaydi;
- server xatolari tafsiloti yashiriladi;
- xavfli sozlamalar bilan server ishga tushmaydi.

## 🔗 Havola ko'rinishi (Telegram, WhatsApp)

Usta `/u/<nom>` havolasini ulashganda chatda rasmli kartochka chiqadi: ismi, sohalari, reytingi, bajargan ishlari, tumani va «Tasdiqlangan usta» belgisi.

- **Sahifa sarlavhalari:** Telegram va WhatsApp JavaScript ishlatmaydi. Shuning uchun `/u/*` so'rovini backend oladi va saytning `index.html` iga `og:*` meta teglarini yozib beradi. Shablon `WEB_INDEX_HTML` dan olinadi, Docker'da avtomatik ulanadi.
- **Kartochka rasmi:** `GET /api/masters/u/:slug/og.png` (1200×630). Serverda SVG'dan chiziladi va xotirada keshlanadi. Ma'lumot o'zgarsa, rasm manzili ham o'zgaradi.
- **Ustalar uchun qo'llanma** (`/ustalar`): kartochka `web/public/og-ustalar.png`, sahifa sarlavhalari backendda yoziladi.
- **Saytning umumiy kartochkasi:** `web/public/og.png`. Uning to'liq manzilini build paytida `PUBLIC_APP_URL` beradi (`web/vite.config.js`).
