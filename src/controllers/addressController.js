import prisma from '../services/prismaClient.js';

// ========== 1. GET ALL ADDRESSES ==========
export const getUserAddresses = async (req, res) => {
    try {
        const { userId } = req.params; // from auth middleware

        const addresses = await prisma.address.findMany({
            where: { userId },
            orderBy: [
                { isDefault: 'desc' }, // default first
                { createdAt: 'desc' },
            ],
            select: {
                id: true,
                label: true,
                customLabel: true,
                addressLine1: true,
                addressLine2: true,
                landmark: true,
                city: true,
                state: true,
                pincode: true,
                country: true,
                latitude: true,
                longitude: true,
                isDefault: true,
                deliveryInstructions: true,
                createdAt: true,
            },
        });

        res.json({
            totalAddresses: addresses.length,
            addresses,
        });
    } catch (err) {
        console.error('Error fetching addresses:', err);
        res.status(500).json({ error: 'Failed to fetch addresses' });
    }
};

// ========== 2. ADD NEW ADDRESS ==========
export const addAddress = async (req, res) => {
    try {
        const { userId } = req.params; // from auth middleware
        const {
            label,
            customLabel,
            addressLine1,
            addressLine2,
            landmark,
            city,
            state,
            pincode,
            country,
            latitude,
            longitude,
            isDefault,
            deliveryInstructions,
        } = req.body;

        // Validation
        if (!label || !addressLine1 || !city || !latitude || !longitude) {
            return res.status(400).json({
                error: 'label, addressLine1, city, latitude, and longitude are required',
            });
        }

        if (!['Home', 'Work', 'Other'].includes(label)) {
            return res.status(400).json({
                error: 'label must be one of: Home, Work, Other',
            });
        }

        if (label === 'Other' && !customLabel) {
            return res.status(400).json({
                error: 'customLabel is required when label is Other',
            });
        }

        // If this is set as default, unset all other defaults
        if (isDefault) {
            await prisma.address.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false },
            });
        }

        const address = await prisma.address.create({
            data: {
                userId,
                label,
                customLabel: label === 'Other' ? customLabel : null,
                addressLine1,
                addressLine2,
                landmark,
                city,
                state,
                pincode,
                country: country || 'India',
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                isDefault: isDefault || false,
                deliveryInstructions,
            },
        });

        res.status(201).json({
            message: 'Address added successfully',
            address,
        });
    } catch (err) {
        console.error('Error adding address:', err);
        res.status(500).json({ error: 'Failed to add address' });
    }
};

// ========== 3. UPDATE ADDRESS ==========
export const updateAddress = async (req, res) => {
    try {
        const { addressId, userId } = req.params;
        const {
            label,
            customLabel,
            addressLine1,
            addressLine2,
            landmark,
            city,
            state,
            pincode,
            country,
            latitude,
            longitude,
            isDefault,
            deliveryInstructions,
        } = req.body;

        // Check if address exists and belongs to user
        const existingAddress = await prisma.address.findFirst({
            where: { id: addressId, userId },
        });

        if (!existingAddress) {
            return res.status(404).json({ error: 'Address not found' });
        }

        // If setting as default, unset others
        if (isDefault) {
            await prisma.address.updateMany({
                where: { userId, isDefault: true, id: { not: addressId } },
                data: { isDefault: false },
            });
        }

        const updatedAddress = await prisma.address.update({
            where: { id: addressId },
            data: {
                ...(label && { label }),
                ...(customLabel !== undefined && { customLabel }),
                ...(addressLine1 && { addressLine1 }),
                ...(addressLine2 !== undefined && { addressLine2 }),
                ...(landmark !== undefined && { landmark }),
                ...(city && { city }),
                ...(state !== undefined && { state }),
                ...(pincode !== undefined && { pincode }),
                ...(country && { country }),
                ...(latitude && { latitude: parseFloat(latitude) }),
                ...(longitude && { longitude: parseFloat(longitude) }),
                ...(isDefault !== undefined && { isDefault }),
                ...(deliveryInstructions !== undefined && { deliveryInstructions }),
            },
        });

        res.json({
            message: 'Address updated successfully',
            address: updatedAddress,
        });
    } catch (err) {
        console.error('Error updating address:', err);
        res.status(500).json({ error: 'Failed to update address' });
    }
};

// ========== 4. DELETE ADDRESS ==========
export const deleteAddress = async (req, res) => {
    try {
        const { addressId, userId } = req.params;

        // Check if address exists and belongs to user
        const existingAddress = await prisma.address.findFirst({
            where: { id: addressId, userId },
        });

        if (!existingAddress) {
            return res.status(404).json({ error: 'Address not found' });
        }

        await prisma.address.delete({
            where: { id: addressId },
        });

        res.json({ message: 'Address deleted successfully' });
    } catch (err) {
        console.error('Error deleting address:', err);
        res.status(500).json({ error: 'Failed to delete address' });
    }
};

// ========== 5. SET DEFAULT ADDRESS ==========
export const setDefaultAddress = async (req, res) => {
    try {

        const { addressId, userId } = req.params;

        // Check if address exists and belongs to user
        const existingAddress = await prisma.address.findFirst({
            where: { id: addressId, userId },
        });

        if (!existingAddress) {
            return res.status(404).json({ error: 'Address not found' });
        }

        // Unset all other defaults
        await prisma.address.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false },
        });

        // Set this as default
        const updatedAddress = await prisma.address.update({
            where: { id: addressId },
            data: { isDefault: true },
        });

        res.json({
            message: 'Default address updated successfully',
            address: updatedAddress,
        });
    } catch (err) {
        console.error('Error setting default address:', err);
        res.status(500).json({ error: 'Failed to set default address' });
    }
};