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
const telegram = require('../controllers/telegram.controller');
const { authenticate } = require('../middleware/auth');
const { otpLimiter } = require('../middleware/rateLimit');

// Ommaviy marshrutlar
router.post('/send-otp', otpLimiter, sendOTP);
router.post('/verify-otp', otpLimiter, verifyOTP);
router.post('/2fa/verify', otpLimiter, verifyTwoFactorLogin);

// Telegram orqali kod olish (kod /verify-otp da tasdiqlanadi)
router.get('/telegram/config', telegram.getConfig);
router.post('/telegram/start', otpLimiter, telegram.startLogin);
router.get('/telegram/requests/:request', telegram.getRequestStatus);

// Himoyalangan marshrutlar
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateMe);
router.delete('/me', authenticate, deleteMe);
router.put('/set-role', authenticate, setRole);
router.post('/logout-all', authenticate, logoutAll);

// Profildan Telegram'ni ulash va bildirishnomalar
router.get('/telegram', authenticate, telegram.getMyTelegram);
router.post('/telegram/link', authenticate, otpLimiter, telegram.startLink);
router.put('/telegram', authenticate, telegram.updateMyTelegram);
router.delete('/telegram', authenticate, telegram.unlinkMyTelegram);

// Ikki bosqichli kirish (authenticator ilovasi)
router.post('/2fa/setup', authenticate, setupTwoFactor);
router.post('/2fa/enable', authenticate, otpLimiter, enableTwoFactor);
router.post('/2fa/disable', authenticate, otpLimiter, disableTwoFactor);

module.exports = router;
