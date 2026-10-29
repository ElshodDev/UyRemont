const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

const authRoutes = require('./auth.routes');
const mastersRoutes = require('./masters.routes');
const ordersRoutes = require('./orders.routes');
const reviewsRoutes = require('./reviews.routes');
const adminRoutes = require('./admin.routes');
const dispatchRoutes = require('./dispatch.routes');
const { getPrices } = require('../controllers/prices.controller');

router.use('/auth', authRoutes);
router.use('/masters', mastersRoutes);
router.use('/orders', ordersRoutes);
router.use('/reviews', reviewsRoutes);
router.use('/admin', adminRoutes);
router.use('/dispatch', dispatchRoutes);
// Taxminiy narxlar (ommaviy)
router.get('/prices', getPrices);

// Salomatlikni tekshirish (Health check) - ma'lumotlar bazasi ulanishi bilan
router.get('/health', async (req, res) => {
    try {
        await query('SELECT 1');
        res.status(200).json({
            success: true,
            message: 'UyRemont API bekamu-ko\'st ishlayapti',
            database: 'ok',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            message: 'Ma\'lumotlar bazasiga ulanib bo\'lmadi',
            database: 'unavailable',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
