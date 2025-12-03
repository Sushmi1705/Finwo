import express from 'express';
import { getBanners } from '../controllers/bannerController.js';

const router = express.Router();

// GET /api/banners?screen=NEAR_ME&componentType=BANNER&location=Chennai&mainCategoryId=<id>&limit=6
router.get('/', getBanners);

export default router;