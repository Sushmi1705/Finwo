import express from 'express';
import { getSuggestions, getSuggestionShops, getQuickSnackMenuCategories } from '../controllers/suggestionsController.js';

const router = express.Router();

router.get('/', getSuggestions);
router.get('/:sectionId/shops', getSuggestionShops);
// suggestionRoutes.js
router.get('/:sectionId/quick-snack-categories', getQuickSnackMenuCategories);

export default router;