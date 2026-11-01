const express = require('express');
const router = express.Router();
const { getContacts, createTicket, listMyTickets } = require('../controllers/support.controller');
const { authenticate } = require('../middleware/auth');

// Qo'llab-quvvatlash kontaktlari (ommaviy)
router.get('/contacts', getContacts);

// Murojaat yuborish va o'z murojaatlarini ko'rish
router.post('/', authenticate, createTicket);
router.get('/my', authenticate, listMyTickets);

module.exports = router;
