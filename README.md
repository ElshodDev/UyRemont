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
| `GET /api/masters` | Qidiruv (`q`), bo'lim (`vertical`), mutaxassislik (`specialization`), tuman, narx, saralash, sahifalash |
| `GET /api/masters/verticals` | Har bir bo'limdagi ustalar soni |
| `GET /api/masters/specializations` | Mutaxassisliklar katalogi (4 bo'lim) |
| `GET /api/masters/:id` | Usta profili, portfolio, sharhlar |
| `PUT /api/masters/profile` | Usta profilini tahrirlash (faqat usta) |
| `GET/POST/DELETE /api/masters/portfolio` | Portfolio rasmlari (fayl yuklash, 8 MB gacha, EXIF/GPS o'chiriladi) |
| `POST /api/orders` | Buyurtma: aniq ustaga yoki mutaxassislik bo'yicha ochiq buyurtma (`photo_ids` bilan) |
| `POST /api/orders/photos`, `DELETE /api/orders/photos/:id` | Muammo rasmi (buyurtmadan oldin yuklanadi, ko'pi bilan 3 ta) |
| `GET /api/orders/:id/photos/:photoId` | Rasm faqat mijozga, taklif olgan/biriktirilgan ustaga va adminga beriladi |
| `GET /api/orders` | Rolga mos buyurtmalar (mijoz / usta / admin) |
| `GET /api/orders/open` | Ustaning mutaxassisligiga mos ochiq buyurtmalar |
| `GET /api/orders/:id` | Tafsilot va chat tarixi (faqat ishtirokchilarga) |
| `PUT /api/orders/:id/status` | Holat o'zgarishi (quyidagi qoidalar bo'yicha) |
| `POST /api/reviews` | Yakunlangan buyurtmaga 1–5 yulduzli sharh |
| `GET /api/admin/stats` | Platforma statistikasi (faqat admin) |
| `GET /api/admin/users`, `PATCH /api/admin/users/:id` | Foydalanuvchilarni qidirish, bloklash, rol berish, ustani tasdiqlash |
| `GET /api/prices` | Taxminiy narxlar ro'yxati (ommaviy) |
| `GET/POST/PUT/DELETE /api/admin/prices`, `PUT /api/admin/specializations/:id/call-fee` | Narxlar va chiqish narxlarini tahrirlash (jurnalga yoziladi) |

**Buyurtma holatlari:**
`pending → accepted → in_progress → completed`, `pending/accepted → cancelled`.
Qabul qilish va ishni boshlash — usta; bekor qilish — mijoz yoki usta; yakunlash — usta yoki mijoz.
Ochiq buyurtmani birinchi qabul qilgan usta unga biriktiriladi (bir vaqtdagi so'rovlardan himoyalangan).
Telefon raqamlar faqat buyurtma qabul qilingandan keyin tomonlarga ko'rinadi.

**Real-time chat (Socket.io):** `join_order_chat`, `send_message`, `new_message`, `order_updated`. Har bir xabarda foydalanuvchi buyurtma ishtirokchisi ekanligi tekshiriladi.

**Xavfsizlik:** helmet, CORS (`CLIENT_URL`), so'rovlar chastotasi cheklovi, kiruvchi ma'lumotlarni tekshirish, parametrlangan SQL, bloklangan foydalanuvchi tokeni va socket ulanishi bekor qilinadi.

### Web Frontend (`/web`) — React + Vite + Tailwind CSS + React Router
- **Katalog:** 4 bo'lim, mutaxassislik va tuman filtrlari, qidiruv, saralash, "ko'proq ko'rsatish" (filtrlar URL da saqlanadi).
- **Telefon + SMS kod orqali kirish**, yangi foydalanuvchidan ism so'raladi.
- **Usta profili:** portfolio, sharhlar, bajarilgan buyurtmalar soni, qo'ng'iroq tugmasi.
- **Buyurtma berish:** aniq ustaga yoki "Usta tanlamasdan buyurtma qoldirish", Telegram orqali ulashish.
- **Buyurtmalarim:** holat filtrlari, buyurtma sahifasida holat bosqichlari, amallar, real-time chat va sharh qoldirish.
- **Usta kabineti:** profil yaratish/tahrirlash, mutaxassisliklar, "Band/Bo'sh" holati, portfolio yuklash, ochiq buyurtmalarni olish.
- **Admin panel** (`/admin`): statistika, foydalanuvchilar (bloklash, rol, tasdiqlash), barcha buyurtmalar.
- **Smart smeta kalkulyatori** — tanlangan xizmat bo'yicha ustalar ro'yxatiga o'tadi.
- **Taxminiy narxlar** (`/prices`): soha bo'yicha ish haqi oralig'i, qidiruv, admin panelda tahrirlanadi.
- **Muammo rasmi:** mijoz chaqiruvga 3 tagacha rasm qo'shadi (telefonda kichraytiriladi), usta taklifda oldindan ko'radi.
- **Tanishtiruv:** birinchi ochilishda 3 ta ekran (o'tkazib yuborish mumkin, «Qoidalar» va profildan qayta ochiladi).
- **Tungi rejim:** telefon sozlamasi bo'yicha yoki profilda tanlanadi.

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

**API:** `GET /api/dispatch/config`, `GET /api/dispatch/estimate`, `POST /api/dispatch/orders`, `GET /api/dispatch/active`, `POST /api/dispatch/orders/:id/cancel`, `GET /api/dispatch/me`, `PUT /api/dispatch/online`, `PUT /api/dispatch/location`, `POST /api/dispatch/offers/:id/accept|decline`, `POST /api/dispatch/orders/:id/rate-client`. Bosqichlar `PUT /api/orders/:id/status` (`arrived`, `in_progress`, `completed` + `final_price`).

**Socket hodisalari:** `order_offer`, `offer_closed`, `dispatch_offline` (usta), `search_update`, `master_location`, `order_updated` (mijoz). Dispetcher holatni bazada (`dispatch_offers`) saqlaydi, shuning uchun server qayta ishga tushsa ham qidiruv davom etadi; bir nechta server nusxasida PostgreSQL advisory lock bilan faqat bittasi dispetcherlik qiladi.

Xarita: Leaflet + OpenStreetMap (kalit talab qilinmaydi). Katta yuklama uchun o'z tile serveringiz yoki Yandex/Google xaritalariga o'tish tavsiya etiladi.

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
| `TELEGRAM_BOT_TOKEN` | @BotFather tokeni (bo'sh bo'lsa Telegram o'chiq) |
| `PUBLIC_APP_URL` | Telegram xabarlaridagi havolalar uchun sayt manzili |
| `TELEGRAM_WEBHOOK_URL` | Production webhook (bo'sh bo'lsa long polling) |
| `PLATFORM_COMMISSION_PERCENT` | Tezkor chaqiruv komissiyasi (standart: 10) |
| `DISPATCH_OFFER_TIMEOUT_SEC`, `DISPATCH_SEARCH_TIMEOUT_MIN` | Taklif va qidiruv vaqtlari |
| `DISPATCH_REQUIRE_VERIFIED` | `false` bo'lsa tasdiqlanmagan ustalar ham tezkor chaqiruv oladi |

`web/.env` (production): `VITE_BACKEND_URL=https://api.sizning-domen.uz`

---

## 🚀 Production
```bash
cd web && npm run build        # dist/ ni statik hosting ga joylang (barcha yo'llar index.html ga yo'naltirilsin)
cd backend && NODE_ENV=production npm start
```
Production da `NODE_ENV=production` o'rnating: OTP kod javobda qaytarilmaydi va server xatolari tafsiloti yashiriladi.
