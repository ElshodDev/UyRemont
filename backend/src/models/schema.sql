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
