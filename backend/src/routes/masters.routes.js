const express = require('express');
const router = express.Router();
const {
    getAllMasters,
    getVerticalStats,
    getMasterById,
    getMasterBySlug,
    getMasterQr,
    getMyPublicLink,
    updateMyPublicLink,
    updateProfile,
    getMyPortfolio,
    uploadPortfolio,
    deletePortfolioItem,
    getSpecializations,
    quickStart,
} = require('../controllers/masters.controller');
const verification = require('../controllers/verification.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');
const { getMyCommission } = require('../controllers/commission.controller');

// Statik yo'llar :id paramdan oldin turishi shart
router.get('/specializations', getSpecializations);
router.get('/verticals', getVerticalStats);

// Barcha ustalarni olish (filtr va qidiruv bilan)
router.get('/', getAllMasters);

// Ommaviy havola: usta24.uz/u/<slug> va uning QR kodi
router.get('/u/:slug', getMasterBySlug);
router.get('/u/:slug/qr', getMasterQr);
router.get('/me/link', authenticate, authorize('master'), getMyPublicLink);
router.get('/me/commission', authenticate, authorize('master'), getMyCommission);
router.put('/me/link', authenticate, authorize('master'), updateMyPublicLink);

// Tasdiqlash: hujjatlar va tekshiruvga yuborish
// Usta bo'lishda ism, familiya va pasport (mijoz hisobidan ham)
router.get('/me/identity', authenticate, verification.getMyIdentity);
router.put('/me/identity', authenticate, verification.saveMyIdentity);
router.get('/me/verification', authenticate, authorize('master'), verification.getMyVerification);
router.post('/me/verification', authenticate, authorize('master'), verification.submitVerification);
router.post('/me/documents', authenticate, authorize('master'), uploadImage.single('image'), verification.uploadDocument);
router.get('/me/documents/:id', authenticate, authorize('master'), verification.getMyDocument);
router.delete('/me/documents/:id', authenticate, authorize('master'), verification.deleteDocument);

// Usta o'z profilini yangilashi
router.put('/profile', authenticate, authorize('master'), updateProfile);

// 1 daqiqada usta bo'lish (mijoz ham, usta ham chaqira oladi: rol shu yerda o'zgaradi; admin - 400)
router.post('/quick-start', authenticate, quickStart);

// Portfolio (rasm fayli yoki URL)
router.get('/portfolio/my', authenticate, authorize('master'), getMyPortfolio);
router.post('/portfolio', authenticate, authorize('master'), uploadImage.single('image'), uploadPortfolio);
router.delete('/portfolio/:itemId', authenticate, authorize('master'), deletePortfolioItem);

// Usta profilini ID bo'yicha olish
router.get('/:id', getMasterById);

module.exports = router;
