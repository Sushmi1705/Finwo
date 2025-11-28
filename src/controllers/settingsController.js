// src/controllers/settingsController.js
import prisma from '../services/prismaClient.js';
import bcrypt from 'bcryptjs';
import { sendOTP, verifyOTP } from '../../twilioClient.js';
import { uploadBufferToCloudinary } from '../lib/upload.js'; // your cloudinary helper
const SALT_ROUNDS = 10;

/**
 * GET /users/me
 */
export async function getMyProfile(req, res) {
    try {
        const userId = req.user?.id || req.body.userId;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                mobile: true,
                profileImageUrl: true,
                upiId: true,
                phoneAuthEnabled: true,
                securityPinSet: true,
                createdAt: true
            }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        let settings = await prisma.setting.findUnique({ where: { userId } });
        if (!settings) settings = await prisma.setting.create({ data: { userId } });

        return res.json({ status: 'ok', user: { ...user, settings } });
    } catch (err) {
        console.error('getMyProfile error', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * PUT /users/me
 * Body: { name?, email?, profileImageUrl? }
 */
export async function updateMyProfile(req, res) {
    try {
        const userId = req.user?.id || req.body.userId;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });

        const { name, email, profileImageUrl } = req.body;
        const data = {};
        if (typeof name !== 'undefined') data.name = name;
        if (typeof email !== 'undefined') {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }
            data.email = email;
        }
        if (typeof profileImageUrl !== 'undefined') data.profileImageUrl = profileImageUrl;

        const updated = await prisma.user.update({ where: { id: userId }, data });

        return res.json({
            status: 'ok',
            user: {
                id: updated.id,
                name: updated.name,
                email: updated.email,
                profileImageUrl: updated.profileImageUrl
            }
        });
    } catch (err) {
        console.error('updateMyProfile error', err);
        if (err?.code === 'P2002') return res.status(409).json({ error: 'Email or mobile already in use' });
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * POST /users/me/change-mobile/request
 * Body: { newMobile, channel? }
 * Sends OTP to newMobile (no DB temporary rows; verification done in verify endpoint).
 */
export async function requestMobileChange(req, res) {
    try {
        const userId = req.user?.id || req.body.userId;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });

        const { newMobile, channel } = req.body;
        if (!newMobile) return res.status(400).json({ error: 'newMobile required' });

        // Basic check: not same as existing
        const me = await prisma.user.findUnique({ where: { id: userId }, select: { mobile: true } });
        if (me.mobile === newMobile) return res.status(400).json({ error: 'New number is same as current number' });

        // Check uniqueness
        const other = await prisma.user.findUnique({ where: { mobile: newMobile } });
        if (other) return res.status(409).json({ error: 'Number already in use' });

        const otpChannel = channel === 'whatsapp' ? 'whatsapp' : 'sms';
        await sendOTP(newMobile, otpChannel);

        return res.json({ status: 'ok', message: `OTP sent to ${newMobile} via ${otpChannel}` });
    } catch (err) {
        console.error('requestMobileChange error', err);
        return res.status(500).json({ error: 'Failed to send OTP' });
    }
}

/**
 * POST /users/me/change-mobile/verify
 * Body: { newMobile, code }
 * Verifies OTP for newMobile and then updates the user's mobile
 */
export async function verifyMobileChange(req, res) {
    try {
        const userId = req.user?.id || req.body.userId;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });
        const { newMobile, code } = req.body;
        if (!newMobile || !code) return res.status(400).json({ error: 'newMobile and code required' });

        // Verify otp for the new number
        const ok = await verifyOTP(newMobile, code);
        if (!ok) return res.status(400).json({ error: 'Invalid OTP' });

        // update mobile (handle unique constraint)
        try {
            const updated = await prisma.user.update({ where: { id: userId }, data: { mobile: newMobile } });
            return res.json({ status: 'ok', message: 'Mobile updated', mobile: updated.mobile });
        } catch (err) {
            if (err?.code === 'P2002') return res.status(409).json({ error: 'Mobile already in use' });
            throw err;
        }
    } catch (err) {
        console.error('verifyMobileChange error', err);
        return res.status(500).json({ error: 'Failed to verify and update mobile' });
    }
}

/**
 * POST /users/me/upi
 * Body: { upiId }
 */
export async function saveUpiId(req, res) {
    try {
        const userId = req.user?.id || req.body.userId;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });
        const { upiId } = req.body;
        if (!upiId) return res.status(400).json({ error: 'upiId required' });

        const trimmed = upiId.trim();
        const upiRegex = /^[a-zA-Z0-9.\-]{2,}@[a-zA-Z]{2,}$/;
        if (!upiRegex.test(trimmed)) return res.status(400).json({ error: 'Invalid UPI id format' });

        await prisma.user.update({ where: { id: userId }, data: { upiId: trimmed } });
        return res.json({ status: 'ok', message: 'UPI id saved', upiId: trimmed });
    } catch (err) {
        console.error('saveUpiId error', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * POST /users/me/security-pin/request-change
 * Sends OTP to the user's registered mobile to allow changing the security PIN
 */
export async function requestSecurityPinChange(req, res) {
    try {
        const userId = req.user?.id || req.body.userId;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { mobile: true } });
        if (!user || !user.mobile) return res.status(400).json({ error: 'No registered mobile to send OTP' });

        await sendOTP(user.mobile, 'sms');
        return res.json({ status: 'ok', message: 'OTP sent to registered mobile' });
    } catch (err) {
        console.error('requestSecurityPinChange error', err);
        return res.status(500).json({ error: 'Failed to send OTP' });
    }
}

/**
 * POST /users/me/security-pin
 * Body: { pin, confirmPin, otp }
 * - Verifies OTP sent to user's registered mobile (for change)
 * - Prevents reuse of current PIN (compares with existing hashed pin and legacy hashed field)
 * - Saves hashed pin to securityPinHash and legacy securityPin, sets securityPinSet true
 */
export async function setSecurityPin(req, res) {
    try {
        const userId = req.user?.id || req.body.userId;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });

        const { pin, confirmPin, otp } = req.body;
        if (!pin || !confirmPin) return res.status(400).json({ error: 'pin and confirmPin are required' });
        if (pin !== confirmPin) return res.status(400).json({ error: 'PIN and confirm PIN do not match' });
        if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 4 or 6 digits' });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, securityPinHash: true, securityPin: true, mobile: true }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const hasExistingPin = Boolean(user.securityPinHash || user.securityPin);

        // If existing pin present, require OTP verification
        if (hasExistingPin) {
            if (!otp) return res.status(400).json({ error: 'OTP required to change PIN' });
            const otpOk = await verifyOTP(user.mobile, otp);
            if (!otpOk) return res.status(400).json({ error: 'Invalid OTP' });
        }

        // Prevent reuse: compare with current hashed or legacy hashed
        if (user.securityPinHash) {
            const same = await bcrypt.compare(pin, user.securityPinHash);
            if (same) return res.status(400).json({ error: 'Security PIN has previously been used. Please enter a new PIN.' });
        }
        if (user.securityPin && user.securityPin === pin) {
            // unlikely if securityPin stores hashed; but keep check for safety if legacy is plaintext (shouldn't be)
            return res.status(400).json({ error: 'Security PIN has previously been used. Please enter a new PIN.' });
        }

        // weak pin checks
        const weakPatterns = new Set(['0000', '1111', '2222', '1234', '1212', '111111', '123456']);
        if (weakPatterns.has(pin)) return res.status(400).json({ error: 'PIN too weak. Choose a stronger PIN.' });

        const newHash = await bcrypt.hash(pin, SALT_ROUNDS);

        await prisma.user.update({
            where: { id: userId },
            data: { securityPinHash: newHash, securityPin: newHash, securityPinSet: true }
        });

        return res.json({ status: 'ok', message: hasExistingPin ? 'Security PIN changed' : 'Security PIN set' });
    } catch (err) {
        console.error('setSecurityPin error', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * POST /users/me/security-pin/verify
 * Body: { pin }
 */
export async function verifySecurityPin(req, res) {
    try {
        const userId = req.user?.id || req.body.userId;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });
        const { pin } = req.body;
        if (!pin) return res.status(400).json({ error: 'pin required' });

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { securityPinHash: true, securityPin: true } });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!user.securityPinHash && !user.securityPin) return res.status(404).json({ error: 'No security PIN set' });

        if (user.securityPinHash) {
            const ok = await bcrypt.compare(pin, user.securityPinHash);
            if (!ok) return res.status(403).json({ error: 'Invalid PIN' });
            return res.json({ status: 'ok', message: 'PIN verified' });
        }

        if (user.securityPin && user.securityPin === pin) {
            return res.json({ status: 'ok', message: 'PIN verified (legacy)' });
        }

        return res.status(403).json({ error: 'Invalid PIN' });
    } catch (err) {
        console.error('verifySecurityPin error', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * GET /users/me/settings
 */
export async function getSettings(req, res) {
    try {
        const userId = req.user?.id || req.body.userId;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });

        let settings = await prisma.setting.findUnique({ where: { userId } });
        if (!settings) settings = await prisma.setting.create({ data: { userId } });

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { securityPinSet: true } });
        const securityPinSet = Boolean(user?.securityPinSet);

        return res.json({ status: 'ok', settings: { ...settings, securityPinSet } });
    } catch (err) {
        console.error('getSettings error', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * PUT /users/me/settings
 * Body: { notificationsEnabled?, reviewNotifications?, paymentNotifications?, darkMode?, appLanguage? }
 */
export async function updateSettings(req, res) {
    try {
        const userId = req.user?.id || req.body.userId;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });

        const { notificationsEnabled, reviewNotifications, paymentNotifications, darkMode, appLanguage } = req.body;
        const data = {};
        if (typeof notificationsEnabled !== 'undefined') data.notificationsEnabled = !!notificationsEnabled;
        if (typeof reviewNotifications !== 'undefined') data.reviewNotifications = !!reviewNotifications;
        if (typeof paymentNotifications !== 'undefined') data.paymentNotifications = !!paymentNotifications;
        if (typeof darkMode !== 'undefined') data.darkMode = !!darkMode;
        if (typeof appLanguage !== 'undefined') data.appLanguage = appLanguage;

        const existing = await prisma.setting.findUnique({ where: { userId } });
        const updated = existing
            ? await prisma.setting.update({ where: { userId }, data })
            : await prisma.setting.create({ data: { userId, ...data } });

        return res.json({ status: 'ok', settings: updated });
    } catch (err) {
        console.error('updateSettings error', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * POST /users/logout
 */
export async function logout(req, res) {
    try {
        // JWT: instruct client to drop token. If token blacklist needed, implement storage.
        return res.json({ status: 'ok', message: 'Logged out' });
    } catch (err) {
        console.error('logout error', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

export async function uploadProfileImage(req, res) {
    try {
        const userId = req.query.userId || req.body.userId;
        if (!userId) return res.status(400).json({ error: 'userId required in query or body' });

        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded. Field name must be "image".' });

        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (!allowed.includes(file.mimetype)) {
            return res.status(400).json({ error: 'Unsupported image type' });
        }

        // Upload to Cloudinary
        const folder = `finwo/profiles/${userId}`;
        const publicId = `profile_${userId}_${Date.now()}`;

        const result = await uploadBufferToCloudinary(file.buffer, {
            resource_type: 'image',
            folder,
            public_id: publicId,
            overwrite: true,
            transformation: [{ width: 1200, height: 1200, crop: 'limit' }]
        });

        // Update user record
        await prisma.user.update({
            where: { id: userId },
            data: { profileImageUrl: result.secure_url }
        });

        return res.json({
            status: 'ok',
            profileImageUrl: result.secure_url,
            public_id: result.public_id
        });
    } catch (err) {
        console.error('uploadProfileImage error', err);
        return res.status(500).json({ error: 'Failed to upload profile image', details: err.message });
    }
}