-- =============================================
-- UyRemont - To'liq PostgreSQL Ma'lumotlar Bazasi Sxemasi
-- =============================================

-- UUID kengaytmasini yoqish
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. FOYDALANUVCHILAR JADVALI
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(15) UNIQUE NOT NULL,           -- Telefon raqam (unique)
    role VARCHAR(10) NOT NULL DEFAULT 'client'   -- Rol: client | master | admin
        CHECK (role IN ('client', 'master', 'admin')),
    name VARCHAR(100),                           -- To'liq ism
    avatar_url TEXT,                             -- Profil rasmi URL
    is_active BOOLEAN DEFAULT TRUE,              -- Faollik holati
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. USTA PROFILLARI JADVALI
-- =============================================
CREATE TABLE IF NOT EXISTS master_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,                                    -- Qisqa ma'lumot
    experience_years INTEGER DEFAULT 0,          -- Tajriba yillari
    hourly_rate DECIMAL(10, 2),                  -- Soatlik narx (so'm)
    district VARCHAR(100),                       -- Tuman
    city VARCHAR(100) DEFAULT 'Toshkent',        -- Shahar
    is_verified BOOLEAN DEFAULT FALSE,           -- Tasdiqlangan holati
    rating DECIMAL(3, 2) DEFAULT 0.00,           -- O'rtacha reyting
    reviews_count INTEGER DEFAULT 0,             -- Sharhlar soni
    is_available BOOLEAN DEFAULT TRUE,           -- Hozir band emasligi
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 3. MUTAXASSISLIKLAR JADVALI
-- =============================================
CREATE TABLE IF NOT EXISTS specializations (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(50),                            -- Barqaror identifikator (santexnik, motor...)
    vertical VARCHAR(20) NOT NULL DEFAULT 'home' -- Bo'lim: home | auto | appliance | gadget
        CHECK (vertical IN ('home', 'auto', 'appliance', 'gadget')),
    name_uz VARCHAR(100) NOT NULL,               -- O'zbek tilida nomi
    name_ru VARCHAR(100),                        -- Rus tilida nomi
    icon VARCHAR(50),                            -- Emoji yoki icon nomi
    is_active BOOLEAN DEFAULT TRUE
);

-- Eski bazalar uchun yangi ustunlar (sxemani qayta ishga tushirish xavfsiz)
ALTER TABLE specializations ADD COLUMN IF NOT EXISTS slug VARCHAR(50);
ALTER TABLE specializations ADD COLUMN IF NOT EXISTS vertical VARCHAR(20) NOT NULL DEFAULT 'home';
CREATE UNIQUE INDEX IF NOT EXISTS idx_specializations_slug ON specializations(slug);

-- Mutaxassisliklar katalogi (4 ta bo'lim)
INSERT INTO specializations (slug, vertical, name_uz, name_ru, icon) VALUES
    -- Uy & Remont
    ('santexnik', 'home', 'Santexnik', 'Сантехник', '🔧'),
    ('elektrik', 'home', 'Elektrik', 'Электрик', '⚡'),
    ('malyar', 'home', 'Malyar / Bo''yoqchi', 'Маляр', '🎨'),
    ('kafel', 'home', 'Kafel / Plitka', 'Плиточник', '🧱'),
    ('gipsokarton', 'home', 'Gipsokarton', 'Гипсокартонщик', '📐'),
    ('mebel', 'home', 'Duradgor / Mebel', 'Плотник / Мебельщик', '🪚'),
    ('oboy', 'home', 'Fon qog''oz (Oboy)', 'Поклейка обоев', '📜'),
    ('laminat', 'home', 'Laminat / Pol', 'Ламинат / Полы', '🪵'),
    ('eshik_oyna', 'home', 'Eshik-oyna ustasi', 'Мастер дверей и окон', '🚪'),
    ('tozalash', 'home', 'Tozalash xizmati', 'Уборка', '🧹'),
    -- Avto-Usta
    ('motor', 'auto', 'Motorchi (Dvigatel)', 'Моторист', '⚙️'),
    ('xodovoy', 'auto', 'Xodovoy qism', 'Ходовая часть', '🛞'),
    ('avtoelektrik', 'auto', 'Avtoelektrik & Magicar', 'Автоэлектрик', '🔋'),
    ('diagnostika', 'auto', 'Kompyuter diagnostika', 'Компьютерная диагностика', '💻'),
    ('kuzov', 'auto', 'Kuzov & Malyarka', 'Кузовной ремонт', '🚗'),
    ('moy', 'auto', 'Moy almashtirish', 'Замена масла', '🛢️'),
    -- Maishiy texnika
    ('konditsioner', 'appliance', 'Konditsioner montaj & tozalash', 'Кондиционеры', '❄️'),
    ('kir_yuvish', 'appliance', 'Kir yuvish mashinasi', 'Стиральные машины', '🫧'),
    ('muzlatgich', 'appliance', 'Muzlatgich & Xolodilnik', 'Холодильники', '🧊'),
    ('gaz_plita', 'appliance', 'Gaz plita & Duxovka', 'Газовые плиты', '🔥'),
    ('qozon', 'appliance', 'Isitish qozonlari (Kotel)', 'Котлы отопления', '♨️'),
    -- Telefon & Kompyuter
    ('iphone', 'gadget', 'iPhone & iPad ta''miri', 'Ремонт iPhone', '🍏'),
    ('android', 'gadget', 'Android (Samsung, Xiaomi)', 'Ремонт Android', '📱'),
    ('noutbuk', 'gadget', 'Noutbuk & Kompyuter', 'Ноутбуки и ПК', '💻'),
    ('ekran', 'gadget', 'Displey almashtirish', 'Замена дисплея', '🔍'),
    ('windows', 'gadget', 'Windows & Dasturlar', 'Windows и программы', '💿')
ON CONFLICT (slug) DO UPDATE SET
    vertical = EXCLUDED.vertical,
    name_uz = EXCLUDED.name_uz,
    name_ru = EXCLUDED.name_ru,
    icon = EXCLUDED.icon,
    is_active = TRUE;

-- Eski sxemadagi slugsiz yozuvlar katalogdan yashiriladi
UPDATE specializations SET is_active = FALSE WHERE slug IS NULL;

-- =============================================
-- 4. USTA - MUTAXASSISLIK (KO'P-KO'P)
-- =============================================
CREATE TABLE IF NOT EXISTS master_specializations (
    master_id UUID NOT NULL REFERENCES master_profiles(id) ON DELETE CASCADE,
    specialization_id INTEGER NOT NULL REFERENCES specializations(id) ON DELETE CASCADE,
    PRIMARY KEY (master_id, specialization_id)
);

-- =============================================
-- 5. PORTFOLIO RASMLARI JADVALI
-- =============================================
CREATE TABLE IF NOT EXISTS portfolio_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    master_id UUID NOT NULL REFERENCES master_profiles(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,                     -- Rasm URL
    description TEXT,                            -- Tavsif
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 6. BUYURTMALAR JADVALI
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    master_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,                 -- Buyurtma sarlavhasi
    description TEXT,                            -- Batafsil tavsif
    address TEXT,                                -- Manzil
    district VARCHAR(100),                       -- Tuman
    status VARCHAR(20) DEFAULT 'pending'         -- Holat
        CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
    budget DECIMAL(12, 2),                       -- Taxminiy narx
    scheduled_at TIMESTAMP WITH TIME ZONE,       -- Rejalashtirilgan vaqt
    specialization_id INTEGER REFERENCES specializations(id) ON DELETE SET NULL, -- Ochiq buyurtma uchun soha
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS specialization_id INTEGER REFERENCES specializations(id) ON DELETE SET NULL;

-- =============================================
-- 7. SHARHLAR JADVALI
-- =============================================
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    master_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5), -- 1-5 yulduz
    comment TEXT,                                -- Sharh matni
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 8. XABARLAR JADVALI (CHAT)
-- =============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,                          -- Xabar matni
    is_read BOOLEAN DEFAULT FALSE,               -- O'qilgan holati
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 9. OTP KODLAR JADVALI
-- =============================================
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(15) NOT NULL,                  -- Telefon raqam
    code VARCHAR(6) NOT NULL,                    -- 6 xonali OTP kod
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Amal qilish muddati
    is_used BOOLEAN DEFAULT FALSE,               -- Ishlatilgan holati
    attempts INTEGER NOT NULL DEFAULT 0,         -- Noto'g'ri kiritishlar soni
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

-- =============================================
-- INDEKSLAR (Tezlashtirish uchun)
-- =============================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Master profiles
CREATE INDEX IF NOT EXISTS idx_master_profiles_user_id ON master_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_master_profiles_district ON master_profiles(district);
CREATE INDEX IF NOT EXISTS idx_master_profiles_rating ON master_profiles(rating DESC);
CREATE INDEX IF NOT EXISTS idx_master_profiles_hourly_rate ON master_profiles(hourly_rate);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_master_id ON orders(master_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_open ON orders(specialization_id) WHERE status = 'pending' AND master_id IS NULL;

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_master_id ON reviews(master_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON reviews(client_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON reviews(order_id);

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_order_id ON messages(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Specializations
CREATE INDEX IF NOT EXISTS idx_specializations_vertical ON specializations(vertical);
CREATE INDEX IF NOT EXISTS idx_master_specializations_spec ON master_specializations(specialization_id);

-- Portfolio
CREATE INDEX IF NOT EXISTS idx_portfolio_master_id ON portfolio_items(master_id);

-- OTP
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_codes(expires_at);

-- =============================================
-- TRIGGER: updated_at avtomatik yangilash
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_master_profiles_updated_at ON master_profiles;
CREATE TRIGGER update_master_profiles_updated_at
    BEFORE UPDATE ON master_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 10. TEZKOR CHAQIRUV (TAXI REJIMI)
-- Mijoz usta chaqiradi, tizim eng yaqin onlayn ustaga navbat bilan taklif yuboradi
-- =============================================

-- Har bir mutaxassislik uchun ustaning chiqish (chaqiruv) narxi.
-- Bo'limlar bo'yicha boshlang'ich qiymat faqat ustun birinchi marta qo'shilganda beriladi,
-- keyin administrator panelida o'zgartirilgan narxlar qayta yozilmaydi.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'specializations' AND column_name = 'call_fee'
    ) THEN
        ALTER TABLE specializations ADD COLUMN call_fee DECIMAL(10, 2) NOT NULL DEFAULT 50000;
        UPDATE specializations SET call_fee = CASE vertical
                WHEN 'auto' THEN 80000
                WHEN 'appliance' THEN 60000
                WHEN 'gadget' THEN 40000
                ELSE 50000
            END;
    END IF;
END $$;

-- Ustaning liniyadagi holati, joylashuvi va takliflar statistikasi
ALTER TABLE master_profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE master_profiles ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE master_profiles ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE master_profiles ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE master_profiles ADD COLUMN IF NOT EXISTS offers_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE master_profiles ADD COLUMN IF NOT EXISTS offers_accepted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE master_profiles ADD COLUMN IF NOT EXISTS missed_offers_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE master_profiles ADD COLUMN IF NOT EXISTS cancelled_jobs INTEGER NOT NULL DEFAULT 0;

-- Mijoz reytingi (ustalar baholaydi)
ALTER TABLE users ADD COLUMN IF NOT EXISTS client_rating DECIMAL(3, 2) NOT NULL DEFAULT 5.00;
ALTER TABLE users ADD COLUMN IF NOT EXISTS client_ratings_count INTEGER NOT NULL DEFAULT 0;

-- Buyurtma: katalog (oddiy) yoki tezkor chaqiruv
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mode VARCHAR(10) NOT NULL DEFAULT 'catalog';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS call_fee DECIMAL(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS final_price DECIMAL(12, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS search_radius_km NUMERIC(5, 1);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS search_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(10);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS late_cancel BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_rating_by_master INTEGER
    CHECK (client_rating_by_master BETWEEN 1 AND 5);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
    'pending', 'searching', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled', 'expired'
));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_mode_check;
ALTER TABLE orders ADD CONSTRAINT orders_mode_check CHECK (mode IN ('catalog', 'instant'));

-- Ustalarga yuborilgan takliflar (har bir buyurtma bir ustaga faqat bir marta taklif qilinadi)
CREATE TABLE IF NOT EXISTS dispatch_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    master_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(10) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
    distance_km NUMERIC(6, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    responded_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (order_id, master_id)
);

-- Bir buyurtmada va bir ustada bir vaqtda faqat bitta faol taklif
CREATE UNIQUE INDEX IF NOT EXISTS idx_dispatch_one_pending_per_order ON dispatch_offers(order_id) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_dispatch_one_pending_per_master ON dispatch_offers(master_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_dispatch_offers_expires ON dispatch_offers(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_master_profiles_online ON master_profiles(is_online) WHERE is_online = TRUE;
CREATE INDEX IF NOT EXISTS idx_orders_searching ON orders(search_started_at) WHERE status = 'searching';
CREATE INDEX IF NOT EXISTS idx_orders_mode_status ON orders(mode, status);

-- =============================================
-- 11. XAVFSIZLIK
-- =============================================

-- Sessiyalarni bekor qilish: token_version oshirilsa barcha eski tokenlar yaroqsiz bo'ladi
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
-- Hisob o'chirilganda shaxsiy ma'lumotlar anonimlashtiriladi
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
-- Foydalanish shartlari va maxfiylik siyosatiga rozilik
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20);
-- Ikki bosqichli kirish (TOTP); maxfiy kalit shifrlangan holda saqlanadi
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_counter BIGINT;

-- Administrator amallari jurnali
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    details JSONB,
    ip VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_phone_created ON otp_codes(phone, created_at DESC);

-- =============================================
-- 12. BUYURTMA RASMLARI VA NARXLAR RO'YXATI
-- =============================================

-- Mijoz muammo rasmini buyurtmadan oldin yuklaydi (order_id hali NULL), buyurtma yaratilganda biriktiriladi.
-- Fayllar ochiq papkada emas: faqat buyurtmaga ruxsati borlarga API orqali beriladi.
CREATE TABLE IF NOT EXISTS order_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_photos_order ON order_photos(order_id);
CREATE INDEX IF NOT EXISTS idx_order_photos_drafts ON order_photos(uploaded_by, created_at) WHERE order_id IS NULL;

-- Taxminiy narxlar (usta ish haqi, materiallar alohida). Administrator panelida tahrirlanadi.
CREATE TABLE IF NOT EXISTS price_items (
    id SERIAL PRIMARY KEY,
    specialization_id INTEGER NOT NULL REFERENCES specializations(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    price_min INTEGER NOT NULL CHECK (price_min >= 0),
    price_max INTEGER CHECK (price_max IS NULL OR price_max >= price_min),
    unit VARCHAR(30) NOT NULL DEFAULT 'ish',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_price_items_spec ON price_items(specialization_id, sort_order);

-- Boshlang'ich narxlar (Toshkent bo'yicha o'rtacha) faqat jadval bo'sh bo'lganda qo'shiladi,
-- keyin administrator o'zgartirgan narxlar qayta yozilmaydi
INSERT INTO price_items (specialization_id, name, price_min, price_max, unit, sort_order)
SELECT s.id, v.name, v.price_min, v.price_max, v.unit, v.sort_order
FROM (VALUES
    ('santexnik', 'Kran (smesitel) almashtirish', 80000, 150000, 'dona', 1),
    ('santexnik', 'Quvur oqishini tuzatish', 80000, 200000, 'ish', 2),
    ('santexnik', 'Rakovina o''rnatish', 150000, 300000, 'dona', 3),
    ('santexnik', 'Unitaz o''rnatish', 200000, 400000, 'dona', 4),
    ('santexnik', 'Suv isitgich (kolonka) o''rnatish', 250000, 450000, 'dona', 5),
    ('elektrik', 'Rozetka yoki o''chirgich almashtirish', 30000, 60000, 'dona', 1),
    ('elektrik', 'Lyustra osish', 80000, 200000, 'dona', 2),
    ('elektrik', 'Avtomat (shit) almashtirish', 60000, 150000, 'dona', 3),
    ('elektrik', 'Yangi sim tortish', 15000, 30000, 'metr', 4),
    ('malyar', 'Devor bo''yash', 25000, 45000, 'kv.m', 1),
    ('malyar', 'Shift bo''yash', 30000, 50000, 'kv.m', 2),
    ('malyar', 'Shpatlyovka', 35000, 60000, 'kv.m', 3),
    ('kafel', 'Devorga kafel yotqizish', 90000, 150000, 'kv.m', 1),
    ('kafel', 'Polga kafel yotqizish', 80000, 140000, 'kv.m', 2),
    ('kafel', 'Eski kafelni olib tashlash', 25000, 40000, 'kv.m', 3),
    ('gipsokarton', 'Gipsokarton shift', 90000, 160000, 'kv.m', 1),
    ('gipsokarton', 'Gipsokarton devor (peregorodka)', 80000, 140000, 'kv.m', 2),
    ('mebel', 'Shkaf yig''ish', 150000, 400000, 'dona', 1),
    ('mebel', 'Oshxona mebelini yig''ish', 150000, 250000, 'metr', 2),
    ('mebel', 'Eshik qulfini almashtirish', 80000, 150000, 'dona', 3),
    ('oboy', 'Oboy yopishtirish', 25000, 45000, 'kv.m', 1),
    ('oboy', 'Eski oboyni olib tashlash', 10000, 20000, 'kv.m', 2),
    ('laminat', 'Laminat yotqizish', 35000, 60000, 'kv.m', 1),
    ('laminat', 'Plintus o''rnatish', 15000, 25000, 'metr', 2),
    ('eshik_oyna', 'Eshik o''rnatish', 250000, 500000, 'dona', 1),
    ('eshik_oyna', 'Plastik oynani sozlash', 80000, 150000, 'dona', 2),
    ('eshik_oyna', 'Oyna rezinasini almashtirish', 15000, 30000, 'metr', 3),
    ('tozalash', 'Kvartirani umumiy tozalash', 15000, 25000, 'kv.m', 1),
    ('tozalash', 'Ta''mirdan keyin tozalash', 25000, 40000, 'kv.m', 2),
    ('tozalash', 'Divan yuvish', 150000, 300000, 'dona', 3),
    ('motor', 'Dvigatel diagnostikasi', 100000, 200000, 'ish', 1),
    ('motor', 'Svechalarni almashtirish', 50000, 100000, 'komplekt', 2),
    ('motor', 'Dvigatel kapital ta''miri', 3000000, 8000000, 'ish', 3),
    ('xodovoy', 'Xodovoy diagnostikasi', 50000, 100000, 'ish', 1),
    ('xodovoy', 'Amortizator almashtirish', 150000, 300000, 'dona', 2),
    ('xodovoy', 'Tormoz kolodkalarini almashtirish', 100000, 200000, 'komplekt', 3),
    ('avtoelektrik', 'Akkumulyator almashtirish', 50000, 100000, 'ish', 1),
    ('avtoelektrik', 'Signalizatsiya (Magicar) o''rnatish', 300000, 600000, 'ish', 2),
    ('avtoelektrik', 'Starter yoki generator ta''miri', 200000, 500000, 'ish', 3),
    ('diagnostika', 'Kompyuter diagnostika', 100000, 200000, 'ish', 1),
    ('diagnostika', 'Xatolarni o''chirish', 50000, 100000, 'ish', 2),
    ('kuzov', 'Bitta detalni bo''yash', 600000, 1200000, 'detal', 1),
    ('kuzov', 'Pachoqni to''g''rilash', 200000, 600000, 'dona', 2),
    ('kuzov', 'Polirovka', 500000, 1200000, 'ish', 3),
    ('moy', 'Motor moyini almashtirish (ish haqi)', 30000, 60000, 'ish', 1),
    ('moy', 'Filtr almashtirish', 20000, 50000, 'dona', 2),
    ('konditsioner', 'Konditsioner o''rnatish', 400000, 700000, 'dona', 1),
    ('konditsioner', 'Konditsionerni tozalash', 150000, 250000, 'dona', 2),
    ('konditsioner', 'Freon to''ldirish', 200000, 400000, 'ish', 3),
    ('kir_yuvish', 'Diagnostika', 50000, 100000, 'ish', 1),
    ('kir_yuvish', 'Nasos (pompa) almashtirish', 200000, 400000, 'ish', 2),
    ('kir_yuvish', 'Podshipnik almashtirish', 400000, 800000, 'ish', 3),
    ('muzlatgich', 'Termostat almashtirish', 200000, 400000, 'ish', 1),
    ('muzlatgich', 'Freon to''ldirish', 300000, 600000, 'ish', 2),
    ('muzlatgich', 'Kompressor almashtirish', 800000, 1800000, 'ish', 3),
    ('gaz_plita', 'Gaz plitani ulash', 100000, 200000, 'ish', 1),
    ('gaz_plita', 'Konforka yoki klapan ta''miri', 100000, 250000, 'ish', 2),
    ('gaz_plita', 'Duxovka termostatini almashtirish', 150000, 350000, 'ish', 3),
    ('qozon', 'Qozonni tozalash (profilaktika)', 200000, 400000, 'ish', 1),
    ('qozon', 'Qozon o''rnatish', 500000, 1200000, 'ish', 2),
    ('qozon', 'Datchik yoki plata ta''miri', 250000, 700000, 'ish', 3),
    ('iphone', 'Ekran almashtirish', 600000, 3500000, 'ish', 1),
    ('iphone', 'Batareya almashtirish', 300000, 900000, 'ish', 2),
    ('iphone', 'Quvvatlash ulagichi ta''miri', 200000, 500000, 'ish', 3),
    ('android', 'Ekran almashtirish', 300000, 2000000, 'ish', 1),
    ('android', 'Batareya almashtirish', 150000, 400000, 'ish', 2),
    ('android', 'Proshivka (dasturiy ta''minot)', 100000, 250000, 'ish', 3),
    ('noutbuk', 'Tozalash va termopasta', 150000, 300000, 'ish', 1),
    ('noutbuk', 'Klaviatura almashtirish', 250000, 600000, 'ish', 2),
    ('noutbuk', 'SSD o''rnatish (ish haqi)', 80000, 150000, 'ish', 3),
    ('ekran', 'Telefon displeyi', 300000, 3000000, 'ish', 1),
    ('ekran', 'Noutbuk matritsasi', 800000, 2500000, 'ish', 2),
    ('ekran', 'Himoya oynasi yopishtirish', 30000, 80000, 'dona', 3),
    ('windows', 'Windows o''rnatish', 100000, 200000, 'ish', 1),
    ('windows', 'Dasturlar o''rnatish', 50000, 150000, 'ish', 2),
    ('windows', 'Virusdan tozalash', 80000, 150000, 'ish', 3)
) AS v(slug, name, price_min, price_max, unit, sort_order)
JOIN specializations s ON s.slug = v.slug
WHERE NOT EXISTS (SELECT 1 FROM price_items);
