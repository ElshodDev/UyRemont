const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const mastersRoutes = require('./masters.routes');
const ordersRoutes = require('./orders.routes');
const reviewsRoutes = require('./reviews.routes');

router.use('/auth', authRoutes);
router.use('/masters', mastersRoutes);
router.use('/orders', ordersRoutes);
router.use('/reviews', reviewsRoutes);

// Salomatlikni tekshirish (Health check)
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'UyRemont API bekamu-ko\'st ishlayapti',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
