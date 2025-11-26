import express from 'express';
import {
  getSuggestionsScreen,
  getSuggestionShops,
  getQuickSnackItemsController,
  getQuickSnackItemShopsController,
} from '../controllers/suggestionsController.js';

const router = express.Router();

// 1) dynamic suggestions list
router.get('/screen/SUGGESTIONS', getSuggestionsScreen);

// 2) shops for NEAR_ME or CATEGORY_BASED suggestion
router.get('/component/:componentId/shops', getSuggestionShops);

// 3A) list quick-snack items for QUICK_SNACK component
router.get('/component/:componentId/quick-snacks', getQuickSnackItemsController);

// 3B) shops for a specific quick-snack item (e.g. pizza)
router.get('/component/:componentId/quick-snacks/shops', getQuickSnackItemShopsController);

export default router;