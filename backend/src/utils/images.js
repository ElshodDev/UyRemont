// =============================================
// UyRemont - Yuklangan rasmlarni xavfsiz saqlash
// - Fayl tarkibi haqiqatan rasm ekanligi tekshiriladi (kengaytma/brauzerga ishonilmaydi)
// - Rasm qayta kodlanadi: ichiga yashirilgan kod yoki "polyglot" fayllar yo'qoladi
// - EXIF (GPS koordinatalar, telefon modeli) o'chiriladi - uy manzili oshkor bo'lmaydi
// =============================================

const crypto = require('crypto');
const path = require('path');
const sharp = require('sharp');
const { HttpError } = require('../middleware/errorHandler');
const { UPLOAD_DIR } = require('../middleware/upload');

const ALLOWED_FORMATS = ['jpeg', 'png', 'webp'];
const MAX_DIMENSION = 1600;
// "Dekompressiya bombasi" dan himoya: juda katta o'lchamli rasmlar rad etiladi
const MAX_INPUT_PIXELS = 40 * 1000 * 1000;

/**
 * @param {Buffer} buffer - multer memoryStorage dan kelgan fayl
 * @returns {Promise<{ fileName: string, filePath: string, url: string }>}
 */
const saveUploadedImage = async (buffer) => {
    let metadata;
    try {
        metadata = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    } catch {
        throw new HttpError(400, 'Fayl rasm emas yoki buzilgan');
    }
    if (!ALLOWED_FORMATS.includes(metadata.format)) {
        throw new HttpError(400, 'Faqat JPG, PNG yoki WEBP rasm yuklash mumkin');
    }

    const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.webp`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    // rotate() EXIF dagi burilishni qo'llaydi; sharp metadata ni sukut bo'yicha saqlamaydi
    await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(filePath);

    return { fileName, filePath, url: `/uploads/${fileName}` };
};

module.exports = { saveUploadedImage };
