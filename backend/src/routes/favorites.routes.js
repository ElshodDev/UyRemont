const express = require('express');
const router = express.Router();
const {
    listFavorites, listFavoriteIds, addFavorite, removeFavorite,
} = require('../controllers/favorites.controller');
const { authenticate } = require('../middleware/auth');

// Sevimli ustalar
router.use(authenticate);
router.get('/', listFavorites);
router.get('/ids', listFavoriteIds);
router.post('/:masterId', addFavorite);
router.delete('/:masterId', removeFavorite);

module.exports = router;
