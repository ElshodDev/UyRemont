const express = require('express');
const router = express.Router();
const {
    sendOTP,
    verifyOTP,
    verifyTwoFactorLogin,
    setupTwoFactor,
    enableTwoFactor,
    disableTwoFactor,
    logoutAll,
    deleteMe,
    getMe,
    updateMe,
    setRole,
} = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { otpLimiter } = require('../middleware/rateLimit');

// Ommaviy marshrutlar
router.post('/send-otp', otpLimiter, sendOTP);
router.post('/verify-otp', otpLimiter, verifyOTP);
router.post('/2fa/verify', otpLimiter, verifyTwoFactorLogin);

// Himoyalangan marshrutlar
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateMe);
router.delete('/me', authenticate, deleteMe);
router.put('/set-role', authenticate, setRole);
router.post('/logout-all', authenticate, logoutAll);

// Ikki bosqichli kirish (authenticator ilovasi)
router.post('/2fa/setup', authenticate, setupTwoFactor);
router.post('/2fa/enable', authenticate, otpLimiter, enableTwoFactor);
router.post('/2fa/disable', authenticate, otpLimiter, disableTwoFactor);

module.exports = router;
