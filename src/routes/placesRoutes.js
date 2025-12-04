import express from 'express';
import { getSavedPlaces } from '../controllers/placesController.js';

const router = express.Router();

// No middleware; userId passed as query param
router.get('/saved', getSavedPlaces);

export default router;