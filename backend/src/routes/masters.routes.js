const express = require('express');
const router = express.Router();
const {
    getAllMasters,
    getMasterById,
    updateProfile,
    uploadPortfolio,
    getSpecializations,
} = require('../controllers/masters.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Mutaxassisliklar ro'yxati (id paramdan oldin turishi shart)
router.get('/specializations', getSpecializations);

// Barcha ustalarni olish (filtr va qidiruv bilan)
router.get('/', getAllMasters);

// Usta profilini ID bo'yicha olish
router.get('/:id', getMasterById);

// Usta o'z profilini yangilashi
router.put('/profile', authenticate, authorize('master'), updateProfile);

// Portfolio yuklash
router.post('/portfolio', authenticate, authorize('master'), uploadPortfolio);

module.exports = router;
