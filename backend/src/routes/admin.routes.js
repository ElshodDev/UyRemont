const express = require('express');
const router = express.Router();
const { getStats, getUsers, updateUser } = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Faqat administratorlar uchun
router.use(authenticate, authorize('admin'));

router.get('/stats', getStats);
router.get('/users', getUsers);
router.patch('/users/:id', updateUser);

module.exports = router;
