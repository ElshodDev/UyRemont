const express = require('express');
const router = express.Router();
const { getMyReferrals, getReferrer, getReferralQr } = require('../controllers/referral.controller');
const { authenticate } = require('../middleware/auth');

// O'z havolasi va statistika (/:code dan oldin turishi shart)
router.get('/me', authenticate, getMyReferrals);

// Taklif sahifasi uchun ommaviy ma'lumot va QR kod
router.get('/:code', getReferrer);
router.get('/:code/qr', getReferralQr);

module.exports = router;
