import express from 'express';
import { requestOTP, verifyOTPAndLogin, setSecurityPin } from '../controllers/authController.js';

const router = express.Router();

router.post('/request-otp', requestOTP);
router.post('/verify-otp', verifyOTPAndLogin);
// set-pin may or may not require auth; for now we keep it public based on your flow
router.post('/set-pin', setSecurityPin);

export default router;