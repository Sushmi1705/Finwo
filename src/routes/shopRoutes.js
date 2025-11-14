import express from 'express';
import {
  getShopsByCategoryAndLocation,
  getShopList,
  getShopDetails,
  getShopReviews,
  getShopAmenities,
  getShopMenu
} from '../controllers/shopController.js';

const router = express.Router();

// Get shops by category and location (query params: lat, lng)
router.get('/category/:categoryId', getShopsByCategoryAndLocation);
// Get detailed info for a specific shop
router.get('/:shopId', getShopList);
router.get('/:shopId/details', getShopDetails);
router.get('/:shopId/reviews', getShopReviews);
router.get('/:shopId/amenities', getShopAmenities);
router.get('/:shopId/menu', getShopMenu);

export default router;