import express from 'express';
import { requestOTP, verifyOTPAndLogin, setSecurityPin } from '../controllers/authController.js';

const router = express.Router();

router.post('/request-otp', requestOTP);
router.post('/verify-otp', verifyOTPAndLogin);
router.post('/set-pin', setSecurityPin);

export default router;