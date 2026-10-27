// =============================================
// UyRemont - Rasm yuklash (portfolio) middleware
// =============================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = ALLOWED_TYPES[file.mimetype];
        cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
});

const uploadImage = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_TYPES[file.mimetype]) {
            const error = new Error('Faqat JPG, PNG yoki WEBP rasm yuklash mumkin');
            error.statusCode = 400;
            return cb(error);
        }
        cb(null, true);
    },
});

module.exports = { uploadImage, UPLOAD_DIR };
