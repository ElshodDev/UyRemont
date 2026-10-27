const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP, getMe, updateMe, setRole } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { otpLimiter } = require('../middleware/rateLimit');

// Ommaviy marshrutlar
router.post('/send-otp', otpLimiter, sendOTP);
router.post('/verify-otp', otpLimiter, verifyOTP);

// Himoyalangan marshrutlar
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateMe);
router.put('/set-role', authenticate, setRole);

module.exports = router;
