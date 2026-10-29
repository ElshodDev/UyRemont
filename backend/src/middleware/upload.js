// =============================================
// UyRemont - Rasm yuklash (portfolio) middleware
// Fayl xotirada qabul qilinadi va src/utils/images.js da tekshirilib, qayta kodlanadi
// =============================================

const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Birinchi bosqich: brauzer aytgan turi. Haqiqiy tarkib keyin sharp bilan tekshiriladi
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const uploadImage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            const error = new Error('Faqat JPG, PNG yoki WEBP rasm yuklash mumkin');
            error.statusCode = 400;
            return cb(error);
        }
        cb(null, true);
    },
});

module.exports = { uploadImage, UPLOAD_DIR, MAX_UPLOAD_BYTES };
