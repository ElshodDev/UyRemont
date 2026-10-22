const express = require('express');
const router = express.Router();
const {
    createOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
} = require('../controllers/orders.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Barcha buyurtma amallari avtorizatsiyadan o'tgan foydalanuvchilar uchun
router.use(authenticate);

// Buyurtma yaratish (faqat mijozlar)
router.post('/', authorize('client'), createOrder);

// Buyurtmalar ro'yxati (mijoz yoki usta uchun mos ravishda)
router.get('/', getOrders);

// Buyurtma tafsilotlari
router.get('/:id', getOrderById);

// Buyurtma holatini yangilash
router.put('/:id/status', updateOrderStatus);

module.exports = router;
