-- =============================================
-- UyRemont - Dastlabki Ma'lumotlar (Seed Data)
-- 10 ta usta, mutaxassisliklar va sharhlar
-- =============================================

-- 1. Mutaxassisliklar
INSERT INTO specializations (id, name_uz, name_ru, icon, is_active) VALUES
(1, 'Santexnik', 'Сантехник', '🔧', TRUE),
(2, 'Elektrik', 'Электрик', '⚡', TRUE),
(3, 'Malyar va Bo''yoqchi', 'Маляр', '🎨', TRUE),
(4, 'Kafelschik va Plitkachi', 'Плиточник', '🧱', TRUE),
(5, 'Gipsokarton ustasi', 'Гипсокартонщик', '📐', TRUE),
(6, 'Duradgor va Mebelchi', 'Плотник / Мебельщик', '🪚', TRUE),
(7, 'Oboyshchi (Fon qog''oz)', 'Поклейка обоев', '📜', TRUE),
(8, 'Pol va Laminat ustasi', 'Ламинат / Полы', '🪵', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. Foydalanuvchilar (Ustalar)
INSERT INTO users (id, phone, role, name, avatar_url, is_active) VALUES
('a0000000-0000-0000-0000-000000000001', '+998901112233', 'master', 'Jamshid Karimov', 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=400', TRUE),
('a0000000-0000-0000-0000-000000000002', '+998902223344', 'master', 'Sherzod Aliyev', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', TRUE),
('a0000000-0000-0000-0000-000000000003', '+998903334455', 'master', 'Rustam Qosimov', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400', TRUE),
('a0000000-0000-0000-0000-000000000004', '+998904445566', 'master', 'Akmal Rahimov', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400', TRUE),
('a0000000-0000-0000-0000-000000000005', '+998905556677', 'master', 'Bobur Mirzayev', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400', TRUE),
('a0000000-0000-0000-0000-000000000006', '+998906667788', 'master', 'Dilshod Normatov', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400', TRUE),
('a0000000-0000-0000-0000-000000000007', '+998907778899', 'master', 'Ulug''bek Yusupov', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400', TRUE),
('a0000000-0000-0000-0000-000000000008', '+998908889900', 'master', 'Jasur Eshonqulov', 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400', TRUE),
('a0000000-0000-0000-0000-000000000009', '+998909990011', 'master', 'Otabek Soliyev', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400', TRUE),
('a0000000-0000-0000-0000-000000000010', '+998901234567', 'master', 'Sardorbek Toxirov', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. Usta Profillari
INSERT INTO master_profiles (id, user_id, bio, experience_years, hourly_rate, district, city, is_verified, rating, reviews_count, is_available) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Santexnika sohasida 12 yillik tajribaga egaman. Isitish tizimlari, kanalizatsiya va smesitel o''rnatish.', 12, 80000, 'Chilonzor', 'Toshkent', TRUE, 4.9, 34, TRUE),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Professional elektrik. Evroremont simlarini tortish, avtomatika va qisqa tutashuvlarni tuzatish.', 8, 90000, 'Yunusobod', 'Toshkent', TRUE, 4.8, 29, TRUE),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Plitka va kafel yotqizish ustasi. 45 gradus burchak kesish, tekis va sifatli terish kafolati.', 10, 100000, 'Mirzo Ulug''bek', 'Toshkent', TRUE, 5.0, 42, TRUE),
('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'Malyarka, shpatlyovka, emulsiya va oboy yopishtirish. Tez va ozoda ishlayman.', 6, 70000, 'Yakkasaroy', 'Toshkent', FALSE, 4.7, 18, TRUE),
('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', 'Gipsokarton va ko''p qavatli shiftlar tayyorlash bo''yicha usta.', 9, 85000, 'Mirobod', 'Toshkent', TRUE, 4.9, 21, TRUE),
('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'Laminat va parket yotqizish, taglik tayyorlash va plintus o''rnatish.', 7, 75000, 'Sergeli', 'Toshkent', TRUE, 4.6, 15, TRUE),
('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', 'Eshik romlar o''rnatish, qulf almashtirish, mebel yig''ish.', 11, 80000, 'Uchtepa', 'Toshkent', TRUE, 4.8, 31, TRUE),
('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', 'Santexnika va vanna xonalarini noldan tayyorlab berish.', 5, 70000, 'Shayxontohur', 'Toshkent', FALSE, 4.5, 9, TRUE),
('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000009', 'Elektromontaj va lyustra, bra, svetodiod lentalar ulash.', 4, 65000, 'Olmazor', 'Toshkent', FALSE, 4.4, 8, TRUE),
('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000010', 'Umumiy ta''mirlash (kompleks remont) brigadiri. 5 kishilik jamoa.', 15, 120000, 'Yashnobod', 'Toshkent', TRUE, 5.0, 56, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 4. Usta - Mutaxassislik bog'lanishi
INSERT INTO master_specializations (master_id, specialization_id) VALUES
('b0000000-0000-0000-0000-000000000001', 1),
('b0000000-0000-0000-0000-000000000002', 2),
('b0000000-0000-0000-0000-000000000003', 4),
('b0000000-0000-0000-0000-000000000004', 3),
('b0000000-0000-0000-0000-000000000004', 7),
('b0000000-0000-0000-0000-000000000005', 5),
('b0000000-0000-0000-0000-000000000006', 8),
('b0000000-0000-0000-0000-000000000007', 6),
('b0000000-0000-0000-0000-000000000008', 1),
('b0000000-0000-0000-0000-000000000009', 2),
('b0000000-0000-0000-0000-000000000010', 3),
('b0000000-0000-0000-0000-000000000010', 4)
ON CONFLICT DO NOTHING;
