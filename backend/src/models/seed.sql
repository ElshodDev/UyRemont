-- =============================================
-- UyRemont - Dastlabki Ma'lumotlar (Seed Data)
-- 17 ta usta (4 ta bo'lim), portfolio va demo mijoz
-- Mutaxassisliklar katalogi schema.sql da yaratiladi
-- =============================================

-- 1. Foydalanuvchilar (Ustalar va demo mijoz)
INSERT INTO users (id, phone, role, name, avatar_url, is_active) VALUES
-- Uy & Remont
('a0000000-0000-0000-0000-000000000001', '+998901112233', 'master', 'Jamshid Karimov', 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=400&auto=format&fit=crop&q=80', TRUE),
('a0000000-0000-0000-0000-000000000002', '+998902223344', 'master', 'Sherzod Aliyev', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80', TRUE),
('a0000000-0000-0000-0000-000000000003', '+998903334455', 'master', 'Rustam Qosimov', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80', TRUE),
('a0000000-0000-0000-0000-000000000004', '+998904445566', 'master', 'Akmal Rahimov', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&auto=format&fit=crop&q=80', TRUE),
('a0000000-0000-0000-0000-000000000005', '+998905556677', 'master', 'Bobur Mirzayev', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80', TRUE),
('a0000000-0000-0000-0000-000000000006', '+998906667788', 'master', 'Dilshod Normatov', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80', TRUE),
('a0000000-0000-0000-0000-000000000007', '+998907778899', 'master', 'Ulug''bek Yusupov', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80', TRUE),
('a0000000-0000-0000-0000-000000000008', '+998908889900', 'master', 'Jasur Eshonqulov', 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=80', TRUE),
('a0000000-0000-0000-0000-000000000009', '+998909990011', 'master', 'Otabek Soliyev', 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&auto=format&fit=crop&q=80', TRUE),
('a0000000-0000-0000-0000-000000000010', '+998901234567', 'master', 'Sardorbek Toxirov', 'https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=400&auto=format&fit=crop&q=80', TRUE),
-- Avto-Usta
('a0000000-0000-0000-0000-000000000011', '+998977104050', 'master', 'Davronbek Xolmatov', 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&auto=format&fit=crop&q=80', TRUE),
('a0000000-0000-0000-0000-000000000012', '+998935051234', 'master', 'Anvar Islomov', 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=400&auto=format&fit=crop&q=80', TRUE),
('a0000000-0000-0000-0000-000000000013', '+998913338899', 'master', 'Qodir aka Xodovik', 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400&auto=format&fit=crop&q=80', TRUE),
-- Maishiy texnika
('a0000000-0000-0000-0000-000000000014', '+998909995544', 'master', 'Temur Valiyev', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80', TRUE),
('a0000000-0000-0000-0000-000000000015', '+998946203040', 'master', 'Muzaffar Toshmatov', 'https://images.unsplash.com/photo-1528892952291-009c663ce843?w=400&auto=format&fit=crop&q=80', TRUE),
-- Telefon & Kompyuter
('a0000000-0000-0000-0000-000000000016', '+998908887766', 'master', 'Farrux ProTech', 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=400&auto=format&fit=crop&q=80', TRUE),
('a0000000-0000-0000-0000-000000000017', '+998994441122', 'master', 'Shohruh Kompyuter', 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&auto=format&fit=crop&q=80', TRUE),
-- Demo mijoz
('c0000000-0000-0000-0000-000000000001', '+998931234567', 'client', 'Dilnoza Ergasheva', NULL, TRUE)
ON CONFLICT DO NOTHING;

-- 2. Usta Profillari
INSERT INTO master_profiles (id, user_id, bio, experience_years, hourly_rate, district, city, is_verified, rating, reviews_count, is_available) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Santexnika sohasida 12 yillik tajribaga egaman. Isitish tizimlari, vanna jihozlari, vodoprovod va kanalizatsiya ishlarini sifatli kafolat bilan bajaraman.', 12, 80000, 'Chilonzor', 'Toshkent', TRUE, 4.9, 34, TRUE),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Kvartira va xususiy uylarda noldan elektr simlarini tortish, shit yig''ish, avtomatika, lyustra va svetodiodlar ulash bo''yicha mutaxassis.', 8, 90000, 'Yunusobod', 'Toshkent', TRUE, 4.8, 29, TRUE),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Har qanday o''lchamdagi kafel, granit va mozaika yotqizish. 45 gradus aniq kesim, lazerli nivelir bilan tekislik kafolati.', 10, 100000, 'Mirzo Ulug''bek', 'Toshkent', TRUE, 5.0, 42, TRUE),
('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'Devorlarni tekislash, malyarka, shpatlyovka, emulsiya va oboy yopishtirish. Tez va ozoda topshiramiz.', 6, 70000, 'Yakkasaroy', 'Toshkent', FALSE, 4.7, 18, TRUE),
('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', 'Gipsokarton devorlar va ko''p qavatli shiftlar tayyorlash bo''yicha usta.', 9, 85000, 'Mirobod', 'Toshkent', TRUE, 4.9, 21, TRUE),
('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'Laminat va parket yotqizish, taglik tayyorlash va plintus o''rnatish.', 7, 75000, 'Sergeli', 'Toshkent', TRUE, 4.6, 15, TRUE),
('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', 'Eshik romlar o''rnatish, qulf almashtirish, mebel yig''ish va ta''mirlash.', 11, 80000, 'Uchtepa', 'Toshkent', TRUE, 4.8, 31, FALSE),
('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', 'Santexnika va vanna xonalarini noldan tayyorlab berish.', 5, 70000, 'Shayxontohur', 'Toshkent', FALSE, 4.5, 9, TRUE),
('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000009', 'Elektromontaj va lyustra, bra, svetodiod lentalar ulash.', 4, 65000, 'Olmazor', 'Toshkent', FALSE, 4.4, 8, TRUE),
('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000010', 'Umumiy ta''mirlash (kompleks remont) brigadiri. 5 kishilik jamoa: bo''yoq, kafel va pardozlash ishlari.', 15, 120000, 'Yashnobod', 'Toshkent', TRUE, 5.0, 56, TRUE),
('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000011', 'Chevrolet (Cobalt, Gentra, Tracker, Malibu) va xorijiy avtomobillar motorini noldan kapital ta''mirlash. 6 oy yozma kafolat.', 14, 120000, 'Sergeli', 'Toshkent', TRUE, 4.9, 48, TRUE),
('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000012', 'Signalizatsiya, Magicar, Starline, videoregistrator o''rnatish, generator va starter tuzatish, qisqa tutashuvlarni aniqlash.', 9, 85000, 'Olmazor', 'Toshkent', TRUE, 4.8, 31, TRUE),
('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000013', 'Amortizator, rul tyaga, sharovoy, tormoz kolodkalarini almashtirish. Mashinadagi har qanday taqillash va ovozlarni topib tuzatamiz.', 16, 95000, 'Chilonzor', 'Toshkent', TRUE, 5.0, 62, TRUE),
('b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000014', 'Konditsioner o''rnatish, freon quyish (R410, R32), parogeneratorda chuqur dezinfeksiya va tozalash. Uyga borib tezkor xizmat.', 7, 90000, 'Mirzo Ulug''bek', 'Toshkent', TRUE, 4.9, 53, TRUE),
('b0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000015', 'LG, Samsung, Artel, Bosch kir yuvish mashinalari va muzlatgichlarni joyida ta''mirlash.', 11, 80000, 'Uchtepa', 'Toshkent', TRUE, 4.7, 27, TRUE),
('b0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000016', 'iPhone displey, akkumulyator almashtirish, Face ID va plata ta''miri. Asl (original) qismlar va 3 oy kafolat.', 8, 95000, 'Mirobod', 'Toshkent', TRUE, 5.0, 39, TRUE),
('b0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000017', 'Noutbuklarni changdan tozalash (termopasta almashtirish), Windows 10/11, litsenziyali dasturlar o''rnatish va ma''lumotlarni tiklash.', 6, 70000, 'Shayxontohur', 'Toshkent', TRUE, 4.8, 22, TRUE)
ON CONFLICT DO NOTHING;

-- 3. Usta - Mutaxassislik bog'lanishi (slug orqali)
INSERT INTO master_specializations (master_id, specialization_id)
SELECT v.master_id::uuid, s.id
FROM (VALUES
    ('b0000000-0000-0000-0000-000000000001', 'santexnik'),
    ('b0000000-0000-0000-0000-000000000002', 'elektrik'),
    ('b0000000-0000-0000-0000-000000000003', 'kafel'),
    ('b0000000-0000-0000-0000-000000000004', 'malyar'),
    ('b0000000-0000-0000-0000-000000000004', 'oboy'),
    ('b0000000-0000-0000-0000-000000000005', 'gipsokarton'),
    ('b0000000-0000-0000-0000-000000000006', 'laminat'),
    ('b0000000-0000-0000-0000-000000000007', 'mebel'),
    ('b0000000-0000-0000-0000-000000000007', 'eshik_oyna'),
    ('b0000000-0000-0000-0000-000000000008', 'santexnik'),
    ('b0000000-0000-0000-0000-000000000009', 'elektrik'),
    ('b0000000-0000-0000-0000-000000000010', 'malyar'),
    ('b0000000-0000-0000-0000-000000000010', 'kafel'),
    ('b0000000-0000-0000-0000-000000000011', 'motor'),
    ('b0000000-0000-0000-0000-000000000011', 'diagnostika'),
    ('b0000000-0000-0000-0000-000000000012', 'avtoelektrik'),
    ('b0000000-0000-0000-0000-000000000013', 'xodovoy'),
    ('b0000000-0000-0000-0000-000000000014', 'konditsioner'),
    ('b0000000-0000-0000-0000-000000000015', 'kir_yuvish'),
    ('b0000000-0000-0000-0000-000000000015', 'muzlatgich'),
    ('b0000000-0000-0000-0000-000000000016', 'iphone'),
    ('b0000000-0000-0000-0000-000000000016', 'ekran'),
    ('b0000000-0000-0000-0000-000000000017', 'noutbuk'),
    ('b0000000-0000-0000-0000-000000000017', 'windows')
) AS v(master_id, slug)
JOIN specializations s ON s.slug = v.slug
WHERE EXISTS (SELECT 1 FROM master_profiles mp WHERE mp.id = v.master_id::uuid)
ON CONFLICT DO NOTHING;

-- 4. Portfolio namunalari
INSERT INTO portfolio_items (id, master_id, image_url, description) VALUES
('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&auto=format&fit=crop&q=80', 'Vanna xonasi santexnikasi'),
('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=600&auto=format&fit=crop&q=80', 'Smesitel va rakovina o''rnatish'),
('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&auto=format&fit=crop&q=80', 'Elektr shit yig''ish'),
('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600&auto=format&fit=crop&q=80', 'Kafel yotqizish'),
('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000011', 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600&auto=format&fit=crop&q=80', 'Motor kapital ta''miri'),
('d0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000014', 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=600&auto=format&fit=crop&q=80', 'Konditsioner montaji')
ON CONFLICT DO NOTHING;
