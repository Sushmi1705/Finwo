// src/routes/reportRoutes.js (ES module)
import express from 'express';
import * as reports from '../controllers/reportsController.js';
const router = express.Router();

router.get('/today-summary', reports.getTodaySummary);
router.get('/daily-transactions', reports.getDailyTransactions);
router.get('/spending-category', reports.getSpendingByCategory);
router.get('/cashback', reports.cashbackSummary);
// router.post('/payments', reports.createPayment);
router.get('/payments', reports.listPayments);
router.get('/transactions', reports.listTransactions);
// router.get('/transactions/summary', reports.transactionsSummary);
// router.get('/reviews/count', reports.reviewsCount);

export default router;