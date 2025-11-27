import express from 'express';
import { upload } from '../lib/upload.js'; // multer
import {
  getToReview, createReview, uploadReviewMedia, getUserReviews,
  getReviewTags, getReviewGuidelines, getAiSuggestions
} from '../controllers/reviewController.js';

const router = express.Router();

router.get('/toreview', getToReview);
router.post('/', createReview);
router.post('/:id/media', upload.array('files', 6), uploadReviewMedia);
router.get('/', getUserReviews);
router.get('/tags', getReviewTags);
router.get('/guidelines', getReviewGuidelines);
router.post('/ai-suggestions', getAiSuggestions);

export default router;