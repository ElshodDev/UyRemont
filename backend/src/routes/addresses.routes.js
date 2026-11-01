const express = require('express');
const router = express.Router();
const {
    listAddresses, createAddress, updateAddress, deleteAddress,
} = require('../controllers/addresses.controller');
const { authenticate } = require('../middleware/auth');

// Saqlangan manzillar (faqat o'ziniki)
router.use(authenticate);
router.get('/', listAddresses);
router.post('/', createAddress);
router.put('/:id', updateAddress);
router.delete('/:id', deleteAddress);

module.exports = router;
