const express = require('express');
const router = express.Router();
const { getStats, getUsers, updateUser, getAuditLog } = require('../controllers/admin.controller');
const {
    getAdminPrices, createPriceItem, updatePriceItem, deletePriceItem, updateCallFee,
} = require('../controllers/prices.controller');
const { listTickets, updateTicket, warnUser } = require('../controllers/support.controller');
const {
    listErrors, resolveError, getAnalytics, getQueues,
} = require('../controllers/monitoring.controller');
const {
    listVerifications, getDocument, approveMaster, rejectMaster,
} = require('../controllers/verification.controller');
const {
    listCommission, getMasterCommission, recordPayment, recordAdjustment,
    listPaymentReviews,
    resolvePaymentReview,
} = require('../controllers/commission.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Faqat administratorlar uchun
router.use(authenticate, authorize('admin'));

router.get('/stats', getStats);
router.get('/users', getUsers);
router.patch('/users/:id', updateUser);
router.post('/users/:id/warnings', warnUser);
router.get('/audit', getAuditLog);

// Narxlar ro'yxati va chiqish narxlari
router.get('/prices', getAdminPrices);
router.post('/prices', createPriceItem);
router.put('/prices/:id', updatePriceItem);
router.delete('/prices/:id', deletePriceItem);
router.put('/specializations/:id/call-fee', updateCallFee);

// Murojaatlar
router.get('/support', listTickets);
router.put('/support/:id', updateTicket);

// Ustalarni tasdiqlash navbati
router.get('/verifications', listVerifications);
router.post('/verifications/:userId/approve', approveMaster);
router.post('/verifications/:userId/reject', rejectMaster);
router.get('/documents/:id', getDocument);

// MVP o'lchovlari va xatolar jurnali
// Komissiya hisobi: ustalar qarzi, to'lovlarni qabul qilish
router.get('/commission', listCommission);
router.get('/commission/payment-reviews', listPaymentReviews);
router.post('/commission/payment-reviews/:orderId', resolvePaymentReview);
router.get('/commission/:masterId', getMasterCommission);
router.post('/commission/:masterId/payments', recordPayment);
router.post('/commission/:masterId/adjustments', recordAdjustment);

router.get('/analytics', getAnalytics);
router.get('/queues', getQueues);
router.get('/errors', listErrors);
router.post('/errors/:id/resolve', resolveError);

module.exports = router;
