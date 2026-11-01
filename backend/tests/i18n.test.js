// Rus tili: API xabarlari (Accept-Language), foydalanuvchi tili (users.language), socket va Telegram xabarlari,
// lug'atning to'liqligi (koddagi barcha xabarlarning ruscha tarjimasi bor)
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { startApp, randomPhone, waitFor, resolveTestDatabaseUrl } = require('./helpers');

// Bazaga ulanadigan modul startApp dan oldin yuklansa ham faqat test bazasi ishlatilsin
// (src/config/database.js ulanishni yuklanish paytida backend/.env dagi DATABASE_URL bilan ochadi)
process.env.DATABASE_URL = resolveTestDatabaseUrl();

const i18n = require('../src/i18n');
const ru = require('../src/i18n/ru');

const RU = { 'Accept-Language': 'ru' };
const POINT = { lat: 41.3301, lng: 69.3301 };
const hasKey = (key) => Object.prototype.hasOwnProperty.call(ru, key);

/**
 * Socket.io mijozi (Node'ning o'z WebSocket'i orqali, engine.io v4 protokoli): hodisalarni yig'adi
 */
const connectSocket = (baseUrl, auth) => new Promise((resolve, reject) => {
    const ws = new WebSocket(`${baseUrl.replace(/^http/, 'ws')}/socket.io/?EIO=4&transport=websocket`);
    const client = {
        events: [],
        emit: (event, payload) => ws.send(`42${JSON.stringify([event, payload])}`),
        waitEvent: (event, predicate = () => true) => waitFor(
            () => client.events.find(([name, payload]) => name === event && predicate(payload))?.[1]
        ),
        close: () => ws.close(),
    };
    ws.onmessage = ({ data }) => {
        const packet = String(data);
        if (packet.startsWith('0')) ws.send(`40${JSON.stringify(auth)}`);
        else if (packet === '2') ws.send('3');
        else if (packet.startsWith('40')) resolve(client);
        else if (packet.startsWith('44')) {
            ws.close();
            reject(Object.assign(new Error('connect_error'), { data: JSON.parse(packet.slice(2)) }));
        } else if (packet.startsWith('42')) client.events.push(JSON.parse(packet.slice(2)));
    };
    ws.onerror = () => reject(new Error('WebSocket xatosi'));
});

describe('i18n: tarjima mexanizmi', () => {
    it('aynan mos, andoza, maydon nomi, ro\'yxat va ichma-ich summa', () => {
        assert.equal(i18n.translate('ru', 'Buyurtma topilmadi'), 'Заказ не найден');
        assert.equal(i18n.translate('uz', 'Buyurtma topilmadi'), 'Buyurtma topilmadi');
        assert.equal(i18n.translate('ru', 'Izoh 300 belgidan oshmasligi kerak'), 'Поле «Комментарий»: не более 300 символов');
        assert.equal(
            i18n.translate('ru', 'Kenglik (lat) -90 va 90 oralig\'ida bo\'lishi kerak'),
            'Поле «Широта (lat)»: значение должно быть от -90 до 90'
        );
        assert.equal(i18n.translate('ru', 'Sabab majburiy'), 'Заполните поле «Причина»');
        // Umumiy "{field} {max} belgidan..." emas, aniqroq andoza
        assert.equal(i18n.translate('ru', 'Xabar 2000 belgidan oshmasligi kerak'), 'Сообщение должно быть не длиннее 2000 символов');
        assert.equal(
            i18n.translate('ru', 'Ishga chiqib bo\'lmaydi: mutaxassislik tanlanmagan, komissiya qarzingiz 60 000 so\'m — limitdan (50 000 so\'m) oshgan, avval to\'lang'),
            'Невозможно выйти на линию: не выбрана специализация, долг по комиссии 60 000 сум превышает лимит (50 000 сум), сначала оплатите его'
        );
        assert.equal(
            i18n.translate('ru', 'To\'lov qabul qilindi: 20 000 so\'m. Qolgan qarz: 40 000 so\'m. Endi ishga chiqishingiz mumkin.'),
            'Платёж принят: 20 000 сум. Остаток долга: 40 000 сум. Теперь вы можете выйти на линию.'
        );
        // {note:raw}: administrator yozgan izoh tarjima qilinmaydi
        assert.equal(
            i18n.translate('ru', 'Komissiya hisobingiz tuzatildi: −5 000 so\'m (Ism). Qarzingiz yo\'q.'),
            'Счёт комиссии скорректирован: −5 000 сум (Ism). Долга нет.'
        );
        assert.equal(i18n.translate('ru', 'Lug\'atda yo\'q matn'), 'Lug\'atda yo\'q matn');
    });

    it('tr: andoza tarjima qilinadi, qiymat o\'zgarmaydi', () => {
        assert.equal(i18n.tr('ru', '📷 Rasm: {n} ta', { n: 2 }), '📷 Фото: 2 шт.');
        assert.equal(i18n.tr('uz', '📷 Rasm: {n} ta', { n: 2 }), '📷 Rasm: 2 ta');
        assert.equal(i18n.tr('ru', 'Sabab: {reason}', { reason: 'Ism' }), 'Причина: Ism');
        assert.equal(i18n.phrase('ru', 'Rejalar o\'zgardi'), 'Планы изменились');
        assert.equal(i18n.phrase('ru', 'Ism majburiy'), 'Ism majburiy', 'phrase andozalarni ishlatmaydi');
    });

    it('Accept-Language va Telegram tili', () => {
        assert.equal(i18n.languageFromHeader('ru'), 'ru');
        assert.equal(i18n.languageFromHeader('ru-RU,ru;q=0.9,en;q=0.8'), 'ru');
        assert.equal(i18n.languageFromHeader('uz'), 'uz');
        assert.equal(i18n.languageFromHeader('en-US,ru;q=0.9'), null);
        assert.equal(i18n.languageFromHeader('*'), null);
        assert.equal(i18n.languageFromHeader(undefined), null);
        assert.equal(i18n.languageFromTelegram('ru'), 'ru');
        assert.equal(i18n.languageFromTelegram('en'), 'uz');
        assert.equal(i18n.languageFromTelegram(undefined), 'uz');
    });
});

describe('i18n: lug\'at to\'liqligi (statik tekshiruv)', () => {
    const ROOT = path.join(__dirname, '..');
    const files = [path.join(ROOT, 'server.js')];
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (file.endsWith('.js') && !file.includes(`${path.sep}i18n${path.sep}`)) files.push(file);
    });
    walk(path.join(ROOT, 'src'));
    // SMS matni Eskiz'da tasdiqlangan andoza bo'lishi kerak - ataylab o'zbekcha qoladi
    const SKIP = ['src/services/sms.service.js'];

    const ESCAPES = { n: '\n', t: '\t', r: '\r' };
    const skipComment = (src, i) => {
        if (src[i] !== '/') return i;
        if (src[i + 1] === '/') return src.indexOf('\n', i) === -1 ? src.length : src.indexOf('\n', i);
        if (src[i + 1] === '*') return src.indexOf('*/', i) + 2;
        return i;
    };
    let readLiteral;
    // ${ ... } ichidagi kodni o'tkazib yuborish (qavslar va satrlar bilan)
    const skipCode = (src, start) => {
        let i = start;
        let depth = 0;
        while (i < src.length) {
            const ch = src[i];
            if (ch === '\'' || ch === '"' || ch === '`') {
                i = readLiteral(src, i).end;
            } else if (ch === '{') {
                depth += 1;
                i += 1;
            } else if (ch === '}') {
                if (depth === 0) return i + 1;
                depth -= 1;
                i += 1;
            } else {
                i += 1;
            }
        }
        return i;
    };
    // Satr yoki shablon literali; shablondagi ${...} o'rniga "1" (andoza bo'yicha tekshiriladi)
    readLiteral = (src, start) => {
        const quote = src[start];
        let value = '';
        let i = start + 1;
        let template = false;
        while (i < src.length && src[i] !== quote) {
            if (src[i] === '\\') {
                value += ESCAPES[src[i + 1]] ?? src[i + 1];
                i += 2;
            } else if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
                i = skipCode(src, i + 2);
                value += '1';
                template = true;
            } else {
                value += src[i];
                i += 1;
            }
        }
        return { value, template, end: i + 1 };
    };
    // Ifodadagi satrlar ('a' + `b` birlashtiriladi); ifoda , ; yoki yopuvchi qavsda tugaydi
    const expressionStrings = (src, start) => {
        const strings = [];
        let i = start;
        let depth = 0;
        let afterString = false;
        let concat = false;
        while (i < src.length) {
            const ch = src[i];
            const next = skipComment(src, i);
            if (next !== i) {
                i = next;
            } else if (ch === '\'' || ch === '"' || ch === '`') {
                const literal = readLiteral(src, i);
                if (concat && strings.length) {
                    const last = strings[strings.length - 1];
                    strings[strings.length - 1] = { value: last.value + literal.value, template: last.template || literal.template };
                } else {
                    strings.push(literal);
                }
                i = literal.end;
                afterString = true;
                concat = false;
            } else if (/\s/.test(ch)) {
                i += 1;
            } else if (ch === '+' && afterString) {
                concat = true;
                i += 1;
            } else {
                afterString = false;
                concat = false;
                if ('([{'.includes(ch)) depth += 1;
                else if (')]}'.includes(ch)) {
                    if (depth === 0) break;
                    depth -= 1;
                } else if ((ch === ',' || ch === ';') && depth === 0) break;
                i += 1;
            }
        }
        return strings;
    };

    // kind: message - tayyor matn (aynan yoki andoza bo'yicha tanilishi kerak); key - lug'atda aynan kalit
    const CONTEXTS = [
        { re: /new HttpError\(\s*\d+\s*,\s*/g, kind: 'message' },
        { re: /\bmessage:\s*/g, kind: 'message' },
        { re: /\bmessage\s*=(?!=)\s*/g, kind: 'message' },
        { re: /\blimitMessage\(\s*/g, kind: 'message' },
        { re: /assertUuid\([^,()]+,\s*/g, kind: 'message' },
        { re: /\b(?:chatError|fail)\(\s*/g, kind: 'message' },
        { re: /\b(?:reasons|missing)\.push\(\s*/g, kind: 'item' },
        { re: /\bfield:\s*/g, kind: 'key' },
        { re: /\btr\(\s*\w+\s*,\s*/g, kind: 'template' },
    ];

    const collect = () => {
        const found = [];
        for (const file of files) {
            const relative = path.relative(ROOT, file).split(path.sep).join('/');
            if (SKIP.includes(relative)) continue;
            const src = fs.readFileSync(file, 'utf8');
            const contexts = relative.startsWith('src/middleware/')
                ? [...CONTEXTS, { re: /\bnew Error\(\s*/g, kind: 'message' }]
                : CONTEXTS;
            for (const { re, kind } of contexts) {
                for (const match of src.matchAll(re)) {
                    for (const literal of expressionStrings(src, match.index + match[0].length)) {
                        // Kod qiymatlari ('TokenExpiredError', 'cancelled') va bo'laklar (' Endi ...') emas
                        if (kind === 'message' && (!/\s/.test(literal.value) || /^\s/.test(literal.value))) continue;
                        if (!literal.value) continue;
                        found.push({ file: relative, kind, ...literal });
                    }
                }
            }
        }
        return found;
    };

    it('koddagi har bir xabar, maydon nomi va Telegram andozasining ruscha tarjimasi bor', () => {
        const found = collect();
        assert.ok(found.length > 250, `kamida 250 ta matn topilishi kerak (${found.length})`);
        const problems = found.filter(({ kind, value, template }) => {
            if (kind === 'key') return !hasKey(value);
            if (kind === 'template') return template || !hasKey(value);
            return !i18n.hasTranslation('ru', value);
        }).map(({ file, kind, value }) => `${file} [${kind}]: ${value}`);
        assert.deepEqual(problems, []);
    });

    it('literal HttpError va message: matnlari lug\'atda aynan bor', () => {
        const literals = collect().filter(({ kind, template }) => kind === 'message' && !template);
        assert.ok(literals.length > 150);
        const missing = literals.filter(({ value }) => !hasKey(value)).map(({ file, value }) => `${file}: ${value}`);
        assert.deepEqual(missing, []);
    });

    it('lug\'atdagi o\'zgaruvchilar tarjimada ham bor', () => {
        const names = (text) => [...text.matchAll(/\{(\w+)(?::\w+)?\}/g)].map((m) => m[1]).sort();
        const mismatched = Object.entries(ru).filter(([key, value]) => names(key).join() !== names(value).join()).map(([key]) => key);
        assert.deepEqual(mismatched, []);
    });

    it('o\'zgaruvchan matnlar: namunaviy qiymatlar bilan', () => {
        const samples = {
            'Noto\'g\'ri kod. Yana 4 ta urinish qoldi': 'Неверный код. Осталось попыток: 4',
            'Kodni qayta yuborish uchun 42 soniya kuting': 'Подождите 42 сек. перед повторной отправкой кода',
            'Sizda 5 ta ochiq murojaat bor. Ular ko\'rib chiqilishini kuting': 'У вас уже есть открытые обращения (5). Дождитесь их рассмотрения',
            'Ko\'pi bilan 3 ta rasm biriktirish mumkin': 'Можно прикрепить не более 3 фото',
            'Murojaatingiz qabul qilindi (#17). Javob shu yerda va Telegram\'da ko\'rinadi': 'Ваше обращение принято (#17). Ответ появится здесь и в Telegram',
            'Yuborishdan oldin qo\'shing: ism, pasport (ID karta) rasmi': 'Перед отправкой добавьте: имя, фото паспорта (ID-карты)',
            'Yo\'l topilmadi - /api/yoq': 'Путь не найден — /api/yoq',
            'Muammo tavsifi kamida 10 belgidan iborat bo\'lishi kerak': 'Поле «Описание проблемы»: не менее 10 символов',
        };
        for (const [uz, expected] of Object.entries(samples)) assert.equal(i18n.translate('ru', uz), expected);
    });

    it('kod ichidagi ro\'yxatlar (taklif natijasi, murojaat holati) tarjima qilingan', () => {
        // Modul yuklanmaydi (bazaga ulanmasligi uchun): obyektlar manba matnidan o'qiladi
        const objectValues = (file, name) => {
            const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
            const start = src.indexOf(`const ${name} = {`);
            assert.ok(start >= 0, `${file}: ${name}`);
            return expressionStrings(src, src.indexOf('{', start)).map((literal) => literal.value);
        };
        const dynamic = [
            ...objectValues('src/services/telegram/notify.js', 'OFFER_RESULT'),
            ...objectValues('src/controllers/support.controller.js', 'STATUS_TEXT'),
        ];
        assert.equal(dynamic.length, 7);
        assert.deepEqual(dynamic.filter((key) => !hasKey(key)), []);
    });
});

describe('i18n: API, socket va Telegram', () => {
    let app;
    let tg;
    const tgId = () => crypto.randomInt(800000000, 899999999);
    const messagesTo = (chatId) => app.telegram.sent.filter((m) => String(m.chat.id) === String(chatId));
    const waitMessage = (chatId, pattern) => waitFor(() => messagesTo(chatId).find((m) => pattern.test(m.text)));
    const linkTelegram = (userId, phone, chatId) => app.db(
        `INSERT INTO telegram_links (telegram_user_id, chat_id, user_id, phone, first_name, notifications)
         VALUES ($1, $1, $2, $3, 'Test', TRUE)`,
        [chatId, userId, phone]
    );
    const from = (id, languageCode) => ({ id, is_bot: false, first_name: 'Ivan', language_code: languageCode });
    const say = (id, text, languageCode) => tg.push({
        message: { message_id: 1, from: from(id, languageCode), chat: { id, type: 'private' }, date: 0, text },
    });

    /**
     * Sarlavhasiz so'rov (Accept-Language umuman yo'q; fetch "*" yuboradi)
     */
    const rawGet = (pathname, token) => new Promise((resolve, reject) => {
        const req = http.request(`${app.url}/api${pathname}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
        });
        req.on('error', reject);
        req.end();
    });

    before(async () => {
        app = await startApp();
        tg = app.telegram;
    });
    after(async () => {
        const missing = i18n.missingTranslations();
        await app.close();
        assert.deepEqual(missing, [], 'tr() da lug\'atda yo\'q andoza ishlatilgan');
    });

    describe('API xabarlari (Accept-Language)', () => {
        let client;
        before(async () => {
            client = await app.tokenFor(randomPhone(), { name: 'Til Mijoz' });
        });

        it('xato xabari: ruscha sarlavha bilan ruscha, sarlavhasiz va uz bilan o\'zbekcha', async () => {
            const id = crypto.randomUUID();
            const ruRes = await app.api(`/orders/${id}`, { token: client.token, headers: RU });
            assert.equal(ruRes.status, 404);
            assert.equal(ruRes.data.message, 'Заказ не найден');
            assert.match(ruRes.headers.get('vary') || '', /Accept-Language/i);

            assert.equal((await app.api(`/orders/${id}`, { token: client.token, headers: { 'Accept-Language': 'ru-RU,ru;q=0.9' } })).data.message, 'Заказ не найден');
            assert.equal((await app.api(`/orders/${id}`, { token: client.token, headers: { 'Accept-Language': 'uz' } })).data.message, 'Buyurtma topilmadi');
            assert.equal((await app.api(`/orders/${id}`, { token: client.token })).data.message, 'Buyurtma topilmadi');
            assert.equal((await rawGet(`/orders/${id}`, client.token)).data.message, 'Buyurtma topilmadi');
        });

        it('avtorizatsiya, 404 yo\'l va noto\'g\'ri JSON xatolari ham tarjima qilinadi', async () => {
            assert.equal((await app.api('/auth/me', { headers: RU })).data.message, 'Токен авторизации не найден');
            assert.equal((await app.api('/auth/me', { token: 'buzilgan', headers: RU })).data.message, 'Недействительный токен');
            assert.equal((await app.api('/yoq-yol', { headers: RU })).data.message, 'Путь не найден — /api/yoq-yol');
            const bad = await fetch(`${app.url}/api/addresses`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...RU }, body: '{buzilgan',
            });
            assert.equal(bad.status, 400);
            assert.equal((await bad.json()).message, 'Неверный формат запроса (JSON)');
        });

        it('o\'zgaruvchili tekshiruv xabari maydon nomi bilan tarjima qilinadi', async () => {
            const lat = await app.api('/addresses', {
                method: 'POST', token: client.token, headers: RU, body: { label: 'Uy', address: 'Chilonzor 1', lat: 200, lng: 69 },
            });
            assert.equal(lat.status, 400);
            assert.equal(lat.data.message, 'Поле «Широта (lat)»: значение должно быть от -90 до 90');

            const short = await app.api('/support', {
                method: 'POST', token: client.token, headers: RU, body: { category: 'app_problem', message: 'qisqa' },
            });
            assert.equal(short.status, 400);
            assert.equal(short.data.message, 'Поле «Описание проблемы»: не менее 10 символов');

            const uz = await app.api('/support', { method: 'POST', token: client.token, body: { category: 'app_problem', message: 'qisqa' } });
            assert.equal(uz.data.message, 'Muammo tavsifi kamida 10 belgidan iborat bo\'lishi kerak');
        });

        it('muvaffaqiyat xabari tarjima qilinadi, boshqa maydonlar o\'zgarmaydi', async () => {
            const created = await app.api('/addresses', {
                method: 'POST', token: client.token, headers: RU, body: { label: 'Ish', address: 'Yunusobod 5' },
            });
            assert.equal(created.status, 201);
            assert.equal(created.data.message, 'Адрес сохранён');
            assert.equal(created.data.data.label, 'Ish', 'ma\'lumotlar tarjima qilinmaydi');
            const removed = await app.api(`/addresses/${created.data.data.id}`, { method: 'DELETE', token: client.token, headers: RU });
            assert.equal(removed.data.message, 'Адрес удалён');

            const config = await app.api('/dispatch/config', { headers: RU });
            assert.equal(config.data.data.client_cancel_reasons[0], 'Rejalar o\'zgardi', 'qiymatlar o\'zgarmaydi');
            const reasons = [...config.data.data.client_cancel_reasons, ...config.data.data.master_cancel_reasons];
            assert.deepEqual(reasons.filter((reason) => !hasKey(reason)), [], 'bekor qilish sabablarining tarjimasi bor');
        });

        it('so\'rovlar cheklovi (express-rate-limit) xabari ham tarjima qilinadi', async () => {
            let last;
            for (let i = 0; i < 31; i += 1) {
                last = await app.api('/client-errors', { method: 'POST', headers: RU, body: {} });
                if (i === 0) assert.equal(last.data.message, 'Нет текста ошибки');
            }
            assert.equal(last.status, 429);
            assert.equal(last.data.message, 'Слишком много отчётов об ошибках');
        });
    });

    describe('foydalanuvchi tili (PUT /auth/me)', () => {
        it('til saqlanadi va /auth/me da qaytadi; ism majburiy emas', async () => {
            const user = await app.tokenFor(randomPhone(), { name: 'Rus Foydalanuvchi' });
            assert.equal((await app.api('/auth/me', { token: user.token })).data.data.language, 'uz');

            const saved = await app.api('/auth/me', { method: 'PUT', token: user.token, headers: RU, body: { language: 'ru' } });
            assert.equal(saved.status, 200);
            assert.equal(saved.data.message, 'Данные сохранены');
            assert.equal(saved.data.data.language, 'ru');
            assert.equal(saved.data.data.name, 'Rus Foydalanuvchi', 'ism o\'zgarmaydi');

            const me = await app.api('/auth/me', { token: user.token });
            assert.equal(me.data.data.language, 'ru');
            // Sarlavha bo'lmasa (yoki "*") saqlangan til, aniq sarlavha bo'lsa sarlavha tili
            const id = crypto.randomUUID();
            assert.equal((await app.api(`/orders/${id}`, { token: user.token })).data.message, 'Заказ не найден');
            assert.equal((await rawGet(`/orders/${id}`, user.token)).data.message, 'Заказ не найден');
            assert.equal((await app.api(`/orders/${id}`, { token: user.token, headers: { 'Accept-Language': 'uz' } })).data.message, 'Buyurtma topilmadi');

            const both = await app.api('/auth/me', { method: 'PUT', token: user.token, body: { name: 'Yangi Ism', language: 'uz' } });
            assert.equal(both.data.data.name, 'Yangi Ism');
            assert.equal(both.data.data.language, 'uz');
        });

        it('noto\'g\'ri til 400; ismsiz va tilsiz so\'rov avvalgidek rad etiladi', async () => {
            const user = await app.tokenFor(randomPhone(), { name: 'Til Xato' });
            const bad = await app.api('/auth/me', { method: 'PUT', token: user.token, body: { language: 'en' } });
            assert.equal(bad.status, 400);
            assert.equal(bad.data.message, 'Noto\'g\'ri til. uz yoki ru ni tanlang');
            const badRu = await app.api('/auth/me', { method: 'PUT', token: user.token, headers: RU, body: { language: 'EN' } });
            assert.equal(badRu.data.message, 'Неверный язык. Выберите uz или ru');
            const [row] = await app.db('SELECT language FROM users WHERE id = $1', [user.id]);
            assert.equal(row.language, 'uz');

            const empty = await app.api('/auth/me', { method: 'PUT', token: user.token, body: {} });
            assert.equal(empty.status, 400);
            assert.equal(empty.data.message, 'Ism kamida 2 belgidan iborat bo\'lishi kerak');
            const shortName = await app.api('/auth/me', { method: 'PUT', token: user.token, body: { name: 'A', language: 'ru' } });
            assert.equal(shortName.status, 400);
        });

        it('ruscha saytda ro\'yxatdan o\'tgan foydalanuvchi tili ru', async () => {
            const phone = randomPhone();
            const otp = await app.api('/auth/send-otp', { method: 'POST', headers: RU, body: { phone } });
            assert.equal(otp.data.message, 'Код подтверждения отправлен');
            const login = await app.api('/auth/verify-otp', {
                method: 'POST', headers: RU, body: { phone, code: otp.data.data.devCode, name: 'Yangi Rus', accept_terms: true },
            });
            assert.equal(login.status, 200);
            assert.equal(login.data.message, 'Вы зарегистрированы');
            assert.equal(login.data.data.user.language, 'ru');
        });
    });

    describe('socket va Telegram xabarlari foydalanuvchi tilida', () => {
        const masterPhone = randomPhone();
        const clientPhone = randomPhone();
        const masterChat = tgId();
        const clientChat = tgId();
        let master;
        let client;
        let admin;
        let masterSocket;
        let clientSocket;
        let specRu;

        before(async () => {
            // Boshqa testlardan qolgan ish rejimidagi ustalar va qidiruvdagi chaqiruvlar xalaqit bermasin
            await app.db(`UPDATE dispatch_offers SET status = 'cancelled' WHERE status = 'pending'`);
            await app.db(`UPDATE orders SET status = 'cancelled' WHERE mode = 'instant' AND status IN ('searching', 'accepted', 'arrived', 'in_progress')`);
            await app.db('UPDATE master_profiles SET is_online = FALSE, missed_offers_streak = 0');

            admin = await app.tokenFor('+998900000000', { role: 'admin' });
            master = await app.tokenFor(masterPhone, { name: 'Ivan Petrov', role: 'master' });
            client = await app.tokenFor(clientPhone, { name: 'Telegram Mijoz' });
            const [profile] = await app.db(
                'INSERT INTO master_profiles (user_id, is_verified, district, city) VALUES ($1, TRUE, \'Mirobod\', \'Toshkent\') RETURNING id',
                [master.id]
            );
            await app.db('INSERT INTO master_specializations (master_id, specialization_id) VALUES ($1, 1)', [profile.id]);
            [{ name_ru: specRu }] = await app.db('SELECT name_ru FROM specializations WHERE id = 1');
            await linkTelegram(master.id, masterPhone, masterChat);
            await linkTelegram(client.id, clientPhone, clientChat);

            // Socket til almashishidan oldin ulanadi: PUT /auth/me ochiq ulanishni ham ruschaga o'tkazishi kerak
            masterSocket = await connectSocket(app.url, { token: master.token });
            clientSocket = await connectSocket(app.url, { token: client.token });
            const res = await app.api('/auth/me', { method: 'PUT', token: master.token, headers: RU, body: { language: 'ru' } });
            assert.equal(res.status, 200);
        });

        after(async () => {
            masterSocket?.close();
            clientSocket?.close();
            await app.api('/dispatch/online', { method: 'PUT', token: master.token, body: { online: false } });
        });

        it('ruscha ustaga to\'g\'ridan-to\'g\'ri buyurtma va bekor qilish xabari ruscha', async () => {
            const order = await app.api('/orders', {
                method: 'POST', token: client.token, body: { title: 'Kran <b>oqyapti</b>', address: 'Uy 7', master_id: master.id },
            });
            assert.equal(order.status, 201);
            const message = await waitMessage(masterChat, /Новый заказ для вас/);
            assert.ok(message, 'ustaga ruscha xabar keldi');
            assert.ok(message.text.includes('Kran &lt;b&gt;oqyapti&lt;/b&gt;'), 'HTML xavfsiz');
            assert.ok(message.text.includes('💰 Бюджет: по договорённости'));
            assert.equal(message.reply_markup.inline_keyboard[0][0].text, '📋 Посмотреть и принять');

            await app.api(`/orders/${order.data.data.id}/status`, { method: 'PUT', token: client.token, body: { status: 'cancelled' } });
            assert.ok(await waitMessage(masterChat, /❌ Заказ отменён: <b>Kran/));
        });

        it('taklif ruscha (mutaxassislik name_ru bilan), qabul qilish tugmasi va mijozga o\'zbekcha', async () => {
            await app.resetCommission(master.id);
            const online = await app.api('/dispatch/online', { method: 'PUT', token: master.token, headers: RU, body: { online: true, ...POINT } });
            assert.equal(online.data.message, 'Вы на линии. Ожидайте заказы');

            const order = await app.api('/dispatch/orders', {
                method: 'POST', token: client.token, body: { specialization_id: 1, ...POINT, address: 'Rus ko\'chasi 1' },
            });
            assert.equal(order.status, 201);
            const offer = await waitMessage(masterChat, /🔔 <b>Новый заказ<\/b>/);
            assert.ok(offer, 'taklif keldi');
            assert.ok(offer.text.includes(`Вызов: ${specRu}`), offer.text);
            assert.ok(offer.text.includes('💰 Стоимость выезда:'));
            assert.match(offer.text, /👤 Клиент: Telegram/);
            const [accept, decline] = offer.reply_markup.inline_keyboard[0];
            assert.equal(accept.text, '✅ Принять');
            assert.equal(decline.text, '❌ Отклонить');
            const socketOffer = await masterSocket.waitEvent('order_offer');
            assert.equal(socketOffer.specialization_name_ru, specRu);

            tg.push({ callback_query: { id: String(Date.now()), from: from(masterChat), data: accept.callback_data, message: { message_id: 1, chat: { id: masterChat, type: 'private' } } } });
            assert.ok(await waitFor(() => tg.answers.find((a) => a.text === '✅ Принято. Отправляйтесь по адресу клиента')));
            const edited = await waitFor(() => tg.edits.find((e) => String(e.message_id) === String(offer.message_id) && /Вы приняли заказ/.test(e.text)));
            assert.ok(edited, 'taklif xabari ruscha yangilandi');
            assert.ok(edited.text.includes('«Я на месте»'));
            assert.ok(edited.reply_markup.inline_keyboard[0].some((b) => b.text === '🧭 Маршрут'));

            // Bir hodisa: usta ruscha, mijoz o'zbekcha oladi (socket va Telegram)
            assert.ok(await waitMessage(clientChat, /Usta topildi/), 'mijozga o\'zbekcha');
            const forMaster = await masterSocket.waitEvent('order_updated', (p) => p.order_id === order.data.data.id && p.message);
            assert.equal(forMaster.message, 'Мастер найден и уже в пути');
            const forClient = await clientSocket.waitEvent('order_updated', (p) => p.order_id === order.data.data.id && p.message);
            assert.equal(forClient.message, 'Usta topildi va yo\'lga chiqdi');

            const cancel = await app.api(`/dispatch/orders/${order.data.data.id}/cancel`, {
                method: 'POST', token: client.token, body: { reason: 'Rejalar o\'zgardi' },
            });
            assert.equal(cancel.status, 200);
            const cancelled = await waitMessage(masterChat, /Заказ отменён: <b>Вызов/);
            assert.ok(cancelled.text.includes('Причина: Планы изменились'), 'tayyor sabab tarjima qilingan');
        });

        it('komissiya xabari: socket va Telegram ruscha, API javobi so\'rov tilida', async () => {
            const payment = await app.api(`/admin/commission/${master.id}/payments`, {
                method: 'POST', token: admin.token, headers: RU, body: { amount: 10000, method: 'cash' },
            });
            assert.equal(payment.status, 201);
            assert.match(payment.data.message, /^Платёж принят\. /);

            const event = await masterSocket.waitEvent('commission_updated');
            assert.match(event.message, /^Платёж принят: 10\s000 сум\. /);
            const telegram = await waitMessage(masterChat, /💳/);
            assert.match(telegram.text, /^💳 Платёж принят: 10\s000 сум/);
            assert.equal(telegram.reply_markup.inline_keyboard[0][0].text, 'Счёт комиссии');
        });

        it('socket ulanish xatosi va chat xatosi tanlangan tilda', async () => {
            await assert.rejects(connectSocket(app.url, { token: 'buzilgan', lang: 'ru' }), (error) => {
                assert.equal(error.data.message, 'Ошибка аутентификации');
                return true;
            });
            masterSocket.emit('join_order_chat', { order_id: 'yoq' });
            const chatError = await masterSocket.waitEvent('chat_error');
            assert.equal(chatError.message, 'Заказ не найден');
        });
    });

    describe('Telegram bot tili', () => {
        it('/start: hisobi yo\'q foydalanuvchiga Telegram ilovasi tilida', async () => {
            const ruChat = tgId();
            say(ruChat, '/start', 'ru');
            const welcome = await waitMessage(ruChat, /Добро пожаловать/);
            assert.ok(welcome);
            assert.equal(welcome.reply_markup.keyboard[0][0].text, '📱 Отправить номер');

            const uzChat = tgId();
            say(uzChat, '/start', 'en');
            assert.ok(await waitMessage(uzChat, /xush kelibsiz/));
        });

        it('kirish: raqam egasining tili (ru) Telegram ilovasi tilidan ustun', async () => {
            const phone = randomPhone();
            const user = await app.tokenFor(phone, { name: 'Kirish Rus' });
            await app.api('/auth/me', { method: 'PUT', token: user.token, body: { language: 'ru' } });

            const start = await app.api('/auth/telegram/start', { method: 'POST', body: { phone } });
            assert.equal(start.data.data.status, 'link');
            const chat = tgId();
            say(chat, `/start ${start.data.data.request}`, 'uz');
            const ask = await waitMessage(chat, /Вход в <b>Usta24<\/b>/);
            assert.ok(ask, 'ruscha so\'rov');
            assert.equal(ask.reply_markup.keyboard[0][0].text, '📱 Отправить номер');

            tg.push({ message: { message_id: 1, from: from(chat, 'uz'), chat: { id: chat, type: 'private' }, date: 0, contact: { phone_number: phone.slice(1), first_name: 'I', user_id: chat } } });
            const code = await waitMessage(chat, /Код для входа/);
            assert.match(code.text, /<code>\d{6}<\/code>/);

            // Saytdan qayta so'ralganda kod xabari saytning joriy tilida (Accept-Language)
            await app.db(`UPDATE otp_codes SET created_at = created_at - INTERVAL '2 minutes' WHERE phone = $1`, [phone]);
            const again = await app.api('/auth/telegram/start', { method: 'POST', headers: { 'Accept-Language': 'uz' }, body: { phone } });
            assert.equal(again.data.data.status, 'sent');
            assert.ok(await waitMessage(chat, /kirish kodi/));
        });

        it('/stop ulangan foydalanuvchi tilida', async () => {
            const phone = randomPhone();
            const user = await app.tokenFor(phone, { name: 'Stop Rus' });
            await app.api('/auth/me', { method: 'PUT', token: user.token, body: { language: 'ru' } });
            const chat = tgId();
            await linkTelegram(user.id, phone, chat);
            say(chat, '/stop', 'uz');
            assert.ok(await waitMessage(chat, /Уведомления отключены/));
        });
    });
});
