import express from 'express';
import {
  getShopsByCategoryAndLocation,
  getShopList,
  getShopDetails,
  getShopReviews,
  getShopAmenities,
  getShopMenu,
  saveShop,
  unsaveShop,
  getSavedShops
} from '../controllers/shopController.js';
// import { authenticate } from './middleware/authenticate.js';

const router = express.Router();

// Get shops by category and location (query params: lat, lng)
router.get('/category/:categoryId', getShopsByCategoryAndLocation);
// Get detailed info for a specific shop
router.get('/savedShops', getSavedShops); 
router.get('/:shopId', getShopList);
router.get('/:shopId/details', getShopDetails);
router.get('/:shopId/reviews', getShopReviews);
router.get('/:shopId/amenities', getShopAmenities);
router.get('/:shopId/menu', getShopMenu);

// Saved shops routes - require authentication
router.post('/:shopId/save', saveShop);       // save
router.delete('/:shopId/save', unsaveShop);   // unsave
         // list user's saved shops

export default router;