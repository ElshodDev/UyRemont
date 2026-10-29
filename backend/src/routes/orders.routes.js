const express = require('express');
const router = express.Router();
const {
    createOrder,
    getOrders,
    getOpenOrders,
    getOrderById,
    updateOrderStatus,
} = require('../controllers/orders.controller');
const { uploadDraftPhoto, deleteDraftPhoto, getOrderPhoto } = require('../controllers/photos.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');

// Barcha buyurtma amallari avtorizatsiyadan o'tgan foydalanuvchilar uchun
router.use(authenticate);

// Buyurtma yaratish (faqat mijozlar)
router.post('/', authorize('client'), createOrder);

// Buyurtmalar ro'yxati (mijoz, usta yoki admin uchun mos ravishda)
router.get('/', getOrders);

// Ustalar uchun ochiq buyurtmalar (:id dan oldin turishi shart)
router.get('/open', authorize('master'), getOpenOrders);

// Muammo rasmi: buyurtmadan oldin yuklanadi va yaratishda photo_ids orqali biriktiriladi
router.post('/photos', authorize('client'), uploadImage.single('image'), uploadDraftPhoto);
router.delete('/photos/:photoId', authorize('client'), deleteDraftPhoto);

// Buyurtma tafsilotlari
router.get('/:id', getOrderById);

// Buyurtma rasmi (faqat ruxsati borlarga)
router.get('/:id/photos/:photoId', getOrderPhoto);

// Buyurtma holatini yangilash
router.put('/:id/status', updateOrderStatus);

module.exports = router;
