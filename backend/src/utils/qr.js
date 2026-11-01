// =============================================
// UyRemont - QR kod: ekran uchun PNG, chop etish uchun SVG (har qanday o'lchamda tiniq)
// =============================================

const QRCode = require('qrcode');

/**
 * QR kodni javob sifatida yuborish
 * @param {import('express').Response} res
 * @param {string} url QR ichidagi manzil
 * @param {{ format?: string, filename: string }} options format=svg bo'lsa SVG, aks holda PNG
 */
const sendQr = async (res, url, { format, filename }) => {
    res.set('Cache-Control', 'public, max-age=86400');
    if (format === 'svg') {
        const svg = await QRCode.toString(url, {
            type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' },
        });
        res.set('Content-Disposition', `inline; filename="${filename}.svg"`);
        return res.type('image/svg+xml').send(svg);
    }
    const png = await QRCode.toBuffer(url, { width: 600, margin: 2, errorCorrectionLevel: 'M' });
    res.set('Content-Disposition', `inline; filename="${filename}.png"`);
    return res.type('image/png').send(png);
};

module.exports = { sendQr };
