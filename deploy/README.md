# 🚀 Usta24'ni serverga joylash

Bitta server ichida hammasi ishlaydi:
- **Caddy** — sayt fayllari, HTTPS sertifikati (Let's Encrypt, avtomatik yangilanadi), xavfsizlik sarlavhalari;
- **backend** — API, real-time chat, dispetcher, Telegram bot;
- **PostgreSQL** — baza;
- **backup** — har kuni zaxira nusxa.

Boshqarish bitta skript orqali: `deploy/usta24.sh`.

## 1. Kerakli narsalar

| | |
|---|---|
| Server (VPS) | Ubuntu 22.04/24.04, kamida **2 GB RAM**, 2 vCPU, 30 GB disk |
| Joylashuv | Shaxsiy ma'lumotlar qonuniga ko'ra (maxfiylik siyosati, 4-band) — O'zbekiston hududidagi server |
| Domen | masalan `usta24.uz` |
| Kirish kodi | Eskiz.uz SMS akkaunti va/yoki Telegram bot tokeni (@BotFather) |

**DNS:** domen panelida `A` yozuvini qo'shing: `usta24.uz → serverning IP manzili`. `www` ham kerak bo'lsa, uni ham qo'shing (pastda 6-bo'limga qarang).

## 2. O'rnatish (bir marta, ~10 daqiqa)

Serverga SSH orqali kiring va quyidagilarni bajaring:

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/ElshodDev/UyRemont.git usta24
cd usta24/deploy
sudo ./usta24.sh install
```

Skript nimalar qiladi:
1. Docker yo'q bo'lsa, ruxsat so'rab o'rnatadi.
2. Domen, administrator raqami, SMS/Telegram va yordam kontaktlarini so'raydi.
3. `deploy/.env` faylini yozadi. Parol va maxfiy kalitlarni o'zi yaratadi, ularni yodda saqlash shart emas.
4. DNS'ni tekshiradi va firewall (ufw) yoqilgan bo'lsa, 80/443 portlarni ochadi.
5. Hammasini yig'ib ishga tushiradi. Birinchi marta 3–5 daqiqa ketadi.

Tugagach `https://usta24.uz` ochiladi. Administrator raqami bilan kiring, keyin ikki bosqichli himoyani (authenticator ilovasi) yoqing.

> `deploy/.env` faylida bazaning paroli va maxfiy kalitlar bor. Uni hech kimga bermang va git'ga qo'shmang (`.gitignore` da bor).

## 3. Kundalik boshqaruv

```bash
cd ~/usta24/deploy
sudo ./usta24.sh status          # xizmatlar holati, oxirgi zaxira, disk
sudo ./usta24.sh logs backend    # loglar (backend, web, db, backup). Chiqish: Ctrl+C
sudo ./usta24.sh update          # yangi versiya: git pull + qayta yig'ish
sudo ./usta24.sh restart         # deploy/.env o'zgargandan keyin
sudo ./usta24.sh stop            # to'xtatish
```

Sozlamani o'zgartirish (masalan, Telegram bot tokenini qo'shish): `nano .env` → saqlash → `sudo ./usta24.sh restart`. Barcha sozlamalar tavsifi `env.example` da.

`DOMAIN` o'zgarsa, `restart` yetmaydi: `sudo ./usta24.sh update` ishlating, chunki sayt yangi manzil bilan qayta yig'iladi.

## 4. Zaxira nusxalar

- Har kuni soat `BACKUP_HOUR` da (sukut bo'yicha 03:00, Toshkent vaqti) `deploy/backups/` ga ikki fayl yoziladi:
  - `db-YYYY-MM-DD_HHMMSS.dump` — baza;
  - `files-….tar.gz` — rasmlar va hujjatlar.
- Kunlik nusxalar 14 kun saqlanadi. Yakshanbadagi nusxa `backups/weekly/` ga ham tushadi va 8 hafta turadi.
- Har bir nusxa yozilgach tiklash mumkinligi tekshiriladi. Zaxira 26 soatdan ortiq olinmasa, `status` da `backup` xizmati `unhealthy` bo'lib ko'rinadi.

```bash
sudo ./usta24.sh backup     # hozir zaxira olish
sudo ./usta24.sh backups    # ro'yxat
sudo ./usta24.sh restore db-2026-11-01_030000.dump files-2026-11-01_030000.tar.gz
```

`restore`:
1. Tasdiq so'raydi.
2. Avval hozirgi holatning nusxasini oladi, shuning uchun noto'g'ri faylni tanlasangiz ham qaytish mumkin.
3. Bazani to'liq almashtiradi.
4. Fayllar arxivi ko'rsatilgan bo'lsa, rasmlarni ham qaytaradi.

**Muhim:** server butunlay ishdan chiqsa, undagi zaxiralar ham yo'qoladi. Nusxalarni boshqa joyga muntazam ko'chiring. Masalan, kompyuteringizdan:

```bash
scp -r root@SERVER_IP:~/usta24/deploy/backups ./usta24-backups
```

Yoki hosting provayderingizning avtomatik disk nusxasi (snapshot) xizmatini yoqing. Bu nusxalarda shaxsiy ma'lumotlar bor, shuning uchun ularni ham O'zbekistondagi xavfsiz joyda saqlang.

## 5. Xavfsizlik (o'zi sozlangan)

- **HTTPS:**
  - sertifikat avtomatik olinadi va yangilanadi;
  - `http://` so'rovlari `https://` ga yo'naltiriladi;
  - HSTS yoqilgan.
- **Xavfsizlik sarlavhalari:**
  - Content-Security-Policy — sayt faqat o'z skriptlarini ishlatadi;
  - `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- **Tashqi kirish:** baza va backend internetga ochiq emas, faqat Caddy (80/443) ochiq.
- **IP manzil:** so'rovlar chastotasi cheklovi foydalanuvchining haqiqiy IP manzili bo'yicha ishlaydi. Soxta `X-Forwarded-For` sarlavhasi hisobga olinmaydi.
- **Production rejimi:** kirish kodi javobda ko'rsatilmaydi; administratorlar uchun 2FA majburiy.
- **Loglar:** hajmi cheklangan (har bir xizmat uchun 5×10 MB).
- **Server to'xtatilganda:** boshlangan so'rovlar tugatiladi, keyin ulanishlar yopiladi.

## 6. Qo'shimcha

**`www.usta24.uz` ham ishlashi uchun.** DNS'ga `www` A yozuvini qo'shing. Keyin `.env` ga `WWW_DOMAIN=www.usta24.uz` ni yozib, `sudo ./usta24.sh restart` ni ishga tushiring. `www` manzili asosiy domenga yo'naltiriladi.

**Telegram webhook.** Bir nechta server nusxasi bo'lmasa, polling yetarli va hech narsa qilish shart emas. Webhook kerak bo'lsa, `.env` ga `TELEGRAM_WEBHOOK_URL=https://usta24.uz/api/telegram/webhook` ni qo'shing.

**Mahalliy sinov (kompyuterda).** `.env` da quyidagilarni qo'ying:

```
DOMAIN=localhost
PUBLIC_APP_URL=https://localhost:8443
HTTP_PORT=8080
HTTPS_PORT=8443
```

Keyin `docker compose up -d --build` → `https://localhost:8443`. Bu holda sertifikat mahalliy bo'ladi va brauzer ogohlantirish beradi.
