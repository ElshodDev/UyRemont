const express = require('express');
const router = express.Router();
const {
    getConfig,
    getEstimate,
    createInstantOrder,
    getActiveOrder,
    cancelInstantOrder,
    getMasterState,
    setOnline,
    updateLocation,
    acceptOffer,
    declineOffer,
    rateClient,
} = require('../controllers/dispatch.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Ishlash qoidalari (ommaviy)
router.get('/config', getConfig);

router.use(authenticate);

// Mijoz: usta chaqirish
router.get('/estimate', getEstimate);
router.post('/orders', authorize('client'), createInstantOrder);
router.get('/active', getActiveOrder);
router.post('/orders/:id/cancel', cancelInstantOrder);

// Usta: liniya, joylashuv va takliflar
router.get('/me', authorize('master'), getMasterState);
router.put('/online', authorize('master'), setOnline);
router.put('/location', authorize('master'), updateLocation);
router.post('/offers/:offerId/accept', authorize('master'), acceptOffer);
router.post('/offers/:offerId/decline', authorize('master'), declineOffer);
router.post('/orders/:id/rate-client', authorize('master'), rateClient);

module.exports = router;
