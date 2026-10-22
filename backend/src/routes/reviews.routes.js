const express = require('express');
const router = express.Router();
const { createReview, getMasterReviews } = require('../controllers/reviews.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Ustanining sharhlarini ko'rish (ommaviy)
router.get('/master/:masterId', getMasterReviews);

// Sharh va reyting qoldirish (faqat mijoz)
router.post('/', authenticate, authorize('client'), createReview);

module.exports = router;
