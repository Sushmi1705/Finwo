// src/routes/searchRoutes.js
import { Router } from 'express';
import {
    getSearchSuggestions,
    searchShops,
    getShopSearchDetail,
    getRecentSearches,
    saveSearchHistory,
    deleteSearchHistory,
    clearSearchHistory,
} from '../controllers/searchController.js';

const router = Router();

// Search suggestions (as user types)
router.get('/suggestions', getSearchSuggestions);

// Global search - returns list of shops
router.get('/shops', searchShops);

// Get detailed info for one shop
router.get('/shop/:id', getShopSearchDetail);

// Search history management
router.get('/recent', getRecentSearches);
router.post('/recent', saveSearchHistory);
router.delete('/recent/:id', deleteSearchHistory);
router.delete('/recent', clearSearchHistory);

export default router;