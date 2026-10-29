const express = require('express');
const router = express.Router();
const { getStats, getUsers, updateUser, getAuditLog } = require('../controllers/admin.controller');
const {
    getAdminPrices, createPriceItem, updatePriceItem, deletePriceItem, updateCallFee,
} = require('../controllers/prices.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Faqat administratorlar uchun
router.use(authenticate, authorize('admin'));

router.get('/stats', getStats);
router.get('/users', getUsers);
router.patch('/users/:id', updateUser);
router.get('/audit', getAuditLog);

// Narxlar ro'yxati va chiqish narxlari
router.get('/prices', getAdminPrices);
router.post('/prices', createPriceItem);
router.put('/prices/:id', updatePriceItem);
router.delete('/prices/:id', deletePriceItem);
router.put('/specializations/:id/call-fee', updateCallFee);

module.exports = router;
