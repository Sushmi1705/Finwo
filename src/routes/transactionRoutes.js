import express from 'express';
import { getUserTransactions } from '../controllers/transactionController.js';

const router = express.Router();

// GET /api/transactions?userId=&status=&dateFilter=&from=&to=&amountFilter=&minPrice=&maxPrice=&limit=&offset=
router.get('/', getUserTransactions);

export default router;