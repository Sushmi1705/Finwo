import express from 'express';
import { getAllMainCategories, getCategoryBanner, getCategoryShopsList } from '../controllers/categoryController.js';
// import { authenticate } from './middleware/authenticate.js';

const router = express.Router();

router.get('/', getAllMainCategories);
router.get('/:categoryId/details', getAllMainCategories);
router.get('/:categoryId/banners', getCategoryBanner);
router.get('/:mainCategoryId/shops', getCategoryShopsList);

export default router;