// src/routes/settingsRoutes.js
import express from 'express';
import {
  getMyProfile,
  updateMyProfile,
  requestMobileChange,
  verifyMobileChange,
  saveUpiId,
  requestSecurityPinChange,
  setSecurityPin,
  verifySecurityPin,
  getSettings,
  updateSettings,
  logout,
  uploadProfileImage
} from '../controllers/settingsController.js';
import { upload } from '../lib/upload.js'; // multer
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

router.get('/me', getMyProfile);
router.put('/me', updateMyProfile);
router.post('/profile-image', upload.single('image'), uploadProfileImage);

// mobile change
router.post('/me/change-mobile/request', requestMobileChange);
router.post('/me/change-mobile/verify', verifyMobileChange);

// upi
router.post('/me/upi', saveUpiId);

// security pin change flow
router.post('/me/security-pin/request-change', requestSecurityPinChange);
router.post('/me/security-pin', setSecurityPin); // create / change
router.post('/me/security-pin/verify', verifySecurityPin);

// settings toggles
router.get('/me/settings', getSettings);
router.put('/me/settings', updateSettings);

// logout
router.post('/logout', logout);

export default router;