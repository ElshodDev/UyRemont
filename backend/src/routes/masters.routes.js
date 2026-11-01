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
} = require('../controllers/masters.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');

// Statik yo'llar :id paramdan oldin turishi shart
router.get('/specializations', getSpecializations);
router.get('/verticals', getVerticalStats);

// Barcha ustalarni olish (filtr va qidiruv bilan)
router.get('/', getAllMasters);

// Ommaviy havola: usta24.uz/u/<slug> va uning QR kodi
router.get('/u/:slug', getMasterBySlug);
router.get('/u/:slug/qr', getMasterQr);
router.get('/me/link', authenticate, authorize('master'), getMyPublicLink);
router.put('/me/link', authenticate, authorize('master'), updateMyPublicLink);

// Usta o'z profilini yangilashi
router.put('/profile', authenticate, authorize('master'), updateProfile);

// Portfolio (rasm fayli yoki URL)
router.get('/portfolio/my', authenticate, authorize('master'), getMyPortfolio);
router.post('/portfolio', authenticate, authorize('master'), uploadImage.single('image'), uploadPortfolio);
router.delete('/portfolio/:itemId', authenticate, authorize('master'), deletePortfolioItem);

// Usta profilini ID bo'yicha olish
router.get('/:id', getMasterById);

module.exports = router;
