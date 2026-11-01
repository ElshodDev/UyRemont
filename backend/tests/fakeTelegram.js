// =============================================
// Testlar uchun soxta Telegram Bot API: getUpdates (long polling), sendMessage, editMessageText...
// Test yangilanish (update) yuboradi va bot yuborgan xabarlarni tekshiradi.
// =============================================

const http = require('http');

const startFakeTelegram = () => new Promise((resolve) => {
    let updates = [];
    let nextUpdateId = 1;
    let nextMessageId = 100;
    let sent = [];
    let edits = [];
    let answers = [];
    let failures = {};
    let waiters = [];

    const json = (res, status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
    };
    const wakeAll = () => {
        const ready = waiters;
        waiters = [];
        ready.forEach((wake) => wake());
    };

    const methods = {
        getMe: () => ({ id: 999, is_bot: true, first_name: 'Usta24', username: 'usta24_test_bot' }),
        setMyCommands: () => true,
        deleteWebhook: () => true,
        setWebhook: () => true,
        sendMessage: (p) => {
            const message = { message_id: nextMessageId++, chat: { id: p.chat_id }, text: p.text, reply_markup: p.reply_markup };
            sent.push(message);
            return message;
        },
        editMessageText: (p) => {
            edits.push(p);
            return { message_id: p.message_id, chat: { id: p.chat_id }, text: p.text };
        },
        editMessageReplyMarkup: (p) => {
            edits.push(p);
            return { message_id: p.message_id, chat: { id: p.chat_id } };
        },
        answerCallbackQuery: (p) => {
            answers.push(p);
            return true;
        },
    };

    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            const params = body ? JSON.parse(body) : {};
            const match = /^\/bot(\d+:[A-Za-z0-9_-]{30,})\/(\w+)$/.exec(req.url);
            if (!match) return json(res, 401, { ok: false, error_code: 401, description: 'Unauthorized' });
            const method = match[2];

            const fail = failures[method];
            if (fail && fail.times > 0) {
                fail.times -= 1;
                return json(res, fail.code, { ok: false, error_code: fail.code, description: fail.description });
            }
            if (method === 'getUpdates') {
                const offset = params.offset || 0;
                updates = updates.filter((u) => u.update_id >= offset);
                const respond = () => json(res, 200, { ok: true, result: updates.filter((u) => u.update_id >= offset) });
                if (updates.length) return respond();
                const timer = setTimeout(() => {
                    waiters = waiters.filter((w) => w !== wake);
                    respond();
                }, Math.min(params.timeout || 0, 1) * 1000);
                const wake = () => {
                    clearTimeout(timer);
                    respond();
                };
                waiters.push(wake);
                return undefined;
            }
            if (!methods[method]) return json(res, 400, { ok: false, error_code: 400, description: `Unknown method ${method}` });
            return json(res, 200, { ok: true, result: methods[method](params) });
        });
    });

    server.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        resolve({
            url: `http://127.0.0.1:${port}`,
            push(update) {
                updates.push({ update_id: nextUpdateId++, ...update });
                wakeAll();
            },
            get sent() { return sent; },
            get edits() { return edits; },
            get answers() { return answers; },
            fail(method, code, description, times = 1) {
                failures[method] = { code, description, times };
            },
            clearFailures() {
                failures = {};
            },
            reset() {
                sent = [];
                edits = [];
                answers = [];
                failures = {};
            },
            close() {
                wakeAll();
                return new Promise((done) => server.close(done));
            },
        });
    });
});

module.exports = { startFakeTelegram };
