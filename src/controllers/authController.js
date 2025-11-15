import prisma from '../services/prismaClient.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendOTP, verifyOTP } from '../../twilioClient.js';

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

// Step 1: Send OTP
export const requestOTP = async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile) return res.status(400).json({ error: 'Mobile number required' });

        await sendOTP(mobile);
        res.json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
};

export const verifyOTPAndLogin = async (req, res) => {
    try {
        console.log('verify-otp body:', req.body);

        const { mobile, code } = req.body || {};
        if (!mobile || !code) {
            return res.status(400).json({ error: 'Mobile and OTP code required' });
        }

        const verification = await verifyOTP(mobile, code);
        console.log('Twilio verification result:', verification);

        if (verification.status !== 'approved') {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        let user = await prisma.user.findUnique({ where: { mobile } });
        if (!user) {
            user = await prisma.user.create({ data: { mobile } });
        }

        const token = jwt.sign(
            { userId: user.id, mobile: user.mobile },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.json({
            message: 'OTP verified',
            token,
            userId: user.id,
            isPinSet: !!user.securityPin,
        });
    } catch (error) {
        console.error('Error verifying OTP:', error);
        return res.status(500).json({ error: 'Failed to verify OTP' });
    }
};
// Step 3: Set security PIN
// body: { userId, pin, enablePhoneAuth }
export const setSecurityPin = async (req, res) => {
    try {
        const { userId, pin, enablePhoneAuth } = req.body;
        if (!userId || !pin) {
            return res.status(400).json({ error: 'User ID and PIN required' });
        }

        const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);

        await prisma.user.update({
            where: { id: userId },
            data: {
                securityPin: pinHash,
                phoneAuthEnabled: !!enablePhoneAuth,   // save user’s choice
            },
        });

        res.json({ message: 'Security PIN set successfully' });
    } catch (error) {
        console.error('Error setting PIN:', error);
        res.status(500).json({ error: 'Failed to set PIN' });
    }
};