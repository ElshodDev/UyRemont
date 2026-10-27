# 🏠 UyRemont (Usta24) — Marketplace Platformasi

Ushbu platforma uy ta'mirlash, avto, maishiy texnika va gadjet ustalarini (santexnik, elektrik, motorchi, konditsioner ustasi va boshqalar) mijozlar bilan to'g'ridan-to'g'ri bog'lovchi marketplace tizimidir.

---

## ⚡ Tezkor Ishga Tushirish (Quick Start)

### Talablar
- Node.js 18+
- PostgreSQL 14+ (lokal yoki Supabase)

### 1. Ma'lumotlar bazasini tayyorlash
```bash
cd backend
npm install
cp .env.example .env          # DATABASE_URL, JWT_SECRET va ADMIN_PHONE ni to'ldiring
npm run db:seed               # jadvallar + mutaxassisliklar + demo ustalar
# yoki faqat sxema (demo ma'lumotlarsiz):
npm run db:setup
```
Skriptlarni qayta ishga tushirish xavfsiz — mavjud (eski) bazaga yangi ustunlar va mutaxassisliklar katalogi qo'shiladi.

### 2. Backend API
```bash
cd backend
npm run dev        # yoki: npm start
```
👉 API manzili: **`http://localhost:5000/api`** (holat: `/api/health`)

### 3. Web Frontend
```bash
cd web
npm install
npm run dev
```
👉 Brauzerda ochiladi: **`http://localhost:3000`** — `/api`, `/uploads` va `/socket.io` so'rovlari Vite proxy orqali backendga yuboriladi.

Windows uchun ikkalasini birga ishga tushirish: `start-dev.bat`

### Kirish (development)
Eskiz SMS sozlanmagan bo'lsa, OTP kod backend konsoliga chiqadi va kirish oynasida ko'rsatiladi.
- **Administrator:** `.env` dagi `ADMIN_PHONE` (standart: `+998900000000`)
- **Demo usta:** `+998901112233` (Jamshid Karimov, santexnik, tasdiqlangan — `/master/work` da liniyaga chiqing)
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
| `GET/POST/DELETE /api/masters/portfolio` | Portfolio rasmlari (fayl yuklash, 5 MB gacha) |
| `POST /api/orders` | Buyurtma: aniq ustaga yoki mutaxassislik bo'yicha ochiq buyurtma |
| `GET /api/orders` | Rolga mos buyurtmalar (mijoz / usta / admin) |
| `GET /api/orders/open` | Ustaning mutaxassisligiga mos ochiq buyurtmalar |
| `GET /api/orders/:id` | Tafsilot va chat tarixi (faqat ishtirokchilarga) |
| `PUT /api/orders/:id/status` | Holat o'zgarishi (quyidagi qoidalar bo'yicha) |
| `POST /api/reviews` | Yakunlangan buyurtmaga 1–5 yulduzli sharh |
| `GET /api/admin/stats` | Platforma statistikasi (faqat admin) |
| `GET /api/admin/users`, `PATCH /api/admin/users/:id` | Foydalanuvchilarni qidirish, bloklash, rol berish, ustani tasdiqlash |

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

---

## ⚡ Tezkor chaqiruv (taksi rejimi)

Yandex Taxi kabi ishlaydi: mijoz usta chaqiradi, tizim eng yaqin bo'sh ustani o'zi topadi.

**Mijoz:** `/call` — xizmat turi → xaritada manzil (GPS yoki qo'lda) → chiqish narxi, liniyadagi ustalar soni va taxminiy yetib kelish vaqti → «Usta chaqirish». Keyin buyurtma sahifasida jonli holat: *Qidiruv → Usta yo'lda (xaritada jonli) → Yetib keldi → Ish → Yakun*.

**Usta:** `/master/work` — «Liniyaga chiqish» tugmasi, bugungi daromad/komissiya/reyting/qabul qilish foizi. Liniyada joylashuv har 15 soniyada yuboriladi; taklif kelganda signal va taymerli oyna chiqadi (Qabul qilish / Rad etish). Faol ishda: Navigator, «Yetib keldim», «Ishni boshlash», «Yakunlash» (yakuniy summa bilan), mijozni baholash.

**Qoidalar** (server tomonda majburiy, `/rules` sahifasida ko'rsatiladi, `backend/src/config/dispatch.js`):

| Qoida | Qiymat |
|---|---|
| Taklif eng yaqin ustaga ketma-ket yuboriladi, javob vaqti | 20 soniya (`DISPATCH_OFFER_TIMEOUT_SEC`) |
| Qidiruv radiusi bosqichma-bosqich kengayadi | 3 → 7 → 15 km |
| Usta topilmasa chaqiruv yopiladi | 5 daqiqa (`DISPATCH_SEARCH_TIMEOUT_MIN`) |
| Ketma-ket javobsiz takliflar → liniyadan avtomatik chiqarish | 3 ta |
| Mijozda bir vaqtda faol chaqiruv | 1 ta |
| Qabuldan keyin bepul bekor qilish | 3 daqiqa (keyin «kech bekor qilish» qayd etiladi) |
| Ish boshlangandan keyin mijoz bekor qila olmaydi | — |
| Usta voz kechsa chaqiruv qayta qidiruvga qaytadi | o'sha ustaga qayta taklif qilinmaydi |
| Liniyaga chiqish: tasdiqlangan profil, mutaxassislik, reyting ≥ 4.0 | `DISPATCH_REQUIRE_VERIFIED` |
| Joylashuvi eskirgan ustaga taklif yuborilmaydi | 10 daqiqa |
| Platforma komissiyasi | 10% (`PLATFORM_COMMISSION_PERCENT`) |
| Ikki tomonlama reyting | mijoz ↔ usta |

**API:** `GET /api/dispatch/config`, `GET /api/dispatch/estimate`, `POST /api/dispatch/orders`, `GET /api/dispatch/active`, `POST /api/dispatch/orders/:id/cancel`, `GET /api/dispatch/me`, `PUT /api/dispatch/online`, `PUT /api/dispatch/location`, `POST /api/dispatch/offers/:id/accept|decline`, `POST /api/dispatch/orders/:id/rate-client`. Bosqichlar `PUT /api/orders/:id/status` (`arrived`, `in_progress`, `completed` + `final_price`).

**Socket hodisalari:** `order_offer`, `offer_closed`, `dispatch_offline` (usta), `search_update`, `master_location`, `order_updated` (mijoz). Dispetcher holatni bazada (`dispatch_offers`) saqlaydi, shuning uchun server qayta ishga tushsa ham qidiruv davom etadi; bir nechta server nusxasida PostgreSQL advisory lock bilan faqat bittasi dispetcherlik qiladi.

Xarita: Leaflet + OpenStreetMap (kalit talab qilinmaydi). Katta yuklama uchun o'z tile serveringiz yoki Yandex/Google xaritalariga o'tish tavsiya etiladi.

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
| `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_FROM` | Eskiz.uz SMS (bo'sh bo'lsa kod konsolga chiqadi) |
| `UPLOAD_DIR` | Portfolio rasmlari papkasi (standart: `backend/uploads`) |
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
