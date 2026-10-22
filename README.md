# 🏠 UyRemont — Marketplace Platformasi

Ushbu platforma uy ta'mirlash ustalari (santexnik, elektrik, malyar, kafelschik va boshqalar) va mijozlarni to'g'ridan-to'g'ri bog'lovchi marketplace tizimidir.

---

## ⚡ Tezkor Ishga Tushirish (Quick Start)

Loyihani bitta fayl orqali ishga tushirish:
```bash
# Windows uchun tayyor fayl:
start-dev.bat
```

Yoki alohida terminallarda:

### 1. Web Frontendni ishga tushirish
```bash
cd web
npm run dev
```
👉 Brauzerda ochiladi: **`http://localhost:3000`**

### 2. Backend API ni ishga tushirish
```bash
cd backend
npm start
```
👉 API manzili: **`http://localhost:5000/api`**

---

## 🏗️ Bajarilgan Ishlar & Arxitektura

### 1. Backend (`/backend`)
- **Node.js + Express** arxitekturasi.
- **Socket.io** real-time chat tizimi (`src/socket/chat.socket.js`).
- **PostgreSQL sxemasi & Dastlabki ma'lumotlar** (`src/models/schema.sql`, `src/models/seed.sql`).
- **REST API Routes**:
  - `/api/auth` — Telefon raqam orqali OTP autentifikatsiya va JWT.
  - `/api/masters` — Ustalarni tuman, narx, reyting bo'yicha qidirish va profillar.
  - `/api/orders` — Buyurtma yaratish va statuslarni boshqarish.
  - `/api/reviews` — Mijozlar sharhlari va 1-5 yulduzli reyting.

### 2. Web Frontend (`/web`)
- **React + Vite + Tailwind CSS** yengil va zamonaviy interfeys.
- **Kategoriyalar bo'yicha filtr** (Santexnik, Elektrik, Malyar, Kafel, Gipsokarton va h.k.).
- **Tumanlar bo'yicha qidiruv** (Chilonzor, Yunusobod, Mirzo Ulug'bek, Yakkasaroy...).
- **Usta profili darchasi** (Portfolio rasmlari, tajriba yillari, telefon raqami).
- **Mijozlar uchun buyurtma berish formasi**.
- **Ustalar uchun ro'yxatdan o'tish formasi** (Platformaga yangi usta qo'shilishi).
