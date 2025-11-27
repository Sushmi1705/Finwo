// src/routes/compareRoutes.js
import express from 'express';
import * as ctrl from '../controllers/compareController.js';

const router = express.Router();

router.post('/add', ctrl.addToCompare);
router.post('/replace', ctrl.replaceCompareItem);
router.post('/remove', ctrl.removeFromCompare);
router.post('/clear', ctrl.clearCompareList);
router.get('/', ctrl.getCompareList);
router.get('/result', ctrl.getCompareResult);

export default router;