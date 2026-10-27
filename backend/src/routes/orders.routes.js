const express = require('express');
const router = express.Router();
const {
    createOrder,
    getOrders,
    getOpenOrders,
    getOrderById,
    updateOrderStatus,
} = require('../controllers/orders.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Barcha buyurtma amallari avtorizatsiyadan o'tgan foydalanuvchilar uchun
router.use(authenticate);

// Buyurtma yaratish (faqat mijozlar)
router.post('/', authorize('client'), createOrder);

// Buyurtmalar ro'yxati (mijoz, usta yoki admin uchun mos ravishda)
router.get('/', getOrders);

// Ustalar uchun ochiq buyurtmalar (:id dan oldin turishi shart)
router.get('/open', authorize('master'), getOpenOrders);

// Buyurtma tafsilotlari
router.get('/:id', getOrderById);

// Buyurtma holatini yangilash
router.put('/:id/status', updateOrderStatus);

module.exports = router;
