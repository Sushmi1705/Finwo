import express from 'express';
import {
    getUserAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
} from '../controllers/addressController.js';
// import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
// router.use(authenticateToken);

// Get all addresses for logged-in user
router.get('/:userId', getUserAddresses);

// Add new address
router.post('/:userId', addAddress);

// Update address
router.patch('/:addressId/:userId', updateAddress);

// Delete address
router.delete('/:addressId/:userId', deleteAddress);

// Set default address
router.patch('/:addressId/set-default/:userId', setDefaultAddress);

export default router;