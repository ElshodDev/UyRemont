const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP, getMe, setRole } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// Ommaviy marshrutlar
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);

// Himoyalangan marshrutlar
router.get('/me', authenticate, getMe);
router.put('/set-role', authenticate, setRole);

module.exports = router;
