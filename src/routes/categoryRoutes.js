import express from 'express';
import { getAllMainCategories, getCategoryBanner } from '../controllers/categoryController.js';

const router = express.Router();

router.get('/', getAllMainCategories);
router.get('/:categoryId/details', getAllMainCategories);
router.get('/:categoryId/details', getCategoryBanner);

export default router;