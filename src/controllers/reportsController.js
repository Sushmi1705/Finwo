// src/controllers/reportsController.js
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import dayjs from 'dayjs';

const prisma = new PrismaClient();
const CASHBACK_RATE = parseFloat(process.env.CASHBACK_RATE || '0.05'); // 5% default

/**
 * parseRange(rangeKey, customFrom, customTo)
 * Accepts: 'today','yesterday','last7days','last10days','last12days','custom'
 * If custom, uses customFrom/customTo (ISO date strings). Defaults to last7days.
 * Returns: { from: Date, to: Date, fromDayjs, toDayjs }
 */
function parseRange(rangeKey, customFrom, customTo) {
    const now = dayjs();
    let fromDayjs, toDayjs;

    switch ((rangeKey || '').toLowerCase()) {
        case 'today':
            fromDayjs = now.startOf('day'); toDayjs = now.endOf('day'); break;
        case 'yesterday':
            fromDayjs = now.subtract(1, 'day').startOf('day'); toDayjs = now.subtract(1, 'day').endOf('day'); break;
        case 'last7days':
        case '7':
            fromDayjs = now.subtract(6, 'day').startOf('day'); toDayjs = now.endOf('day'); break;
        case 'last10days':
        case '10':
            fromDayjs = now.subtract(9, 'day').startOf('day'); toDayjs = now.endOf('day'); break;
        case 'last12days':
        case '12':
            fromDayjs = now.subtract(11, 'day').startOf('day'); toDayjs = now.endOf('day'); break;
        case 'custom':
            if (!customFrom || !customTo) {
                fromDayjs = now.subtract(6, 'day').startOf('day'); toDayjs = now.endOf('day');
            } else {
                fromDayjs = dayjs(customFrom).startOf('day'); toDayjs = dayjs(customTo).endOf('day');
            }
            break;
        default:
            fromDayjs = now.subtract(6, 'day').startOf('day'); toDayjs = now.endOf('day');
    }

    return { from: fromDayjs.toDate(), to: toDayjs.toDate(), fromDayjs, toDayjs };
}

function handleError(res, ctx, err) {
    console.error(`[reportsController] ${ctx}:`, err);
    return res.status(500).json({ error: 'Internal server error' });
}

/**
 * GET /api/reports/overview
 * Query: userId (optional), range (optional), from,to (if custom)
 * Response: { period, summary, daily[], spendingByCategory[] }
 */
export async function getTodaySummary(req, res) {
    try {
        const schema = Joi.object({
            userId: Joi.string().optional()
        });

        const { error, value } = schema.validate(req.query);
        if (error) return res.status(400).json({ error: error.message });

        const { userId } = value;

        const todayStart = dayjs().startOf('day').toDate();
        const todayEnd = dayjs().endOf('day').toDate();

        const whereClause = { createdAt: { gte: todayStart, lte: todayEnd } };
        if (userId) whereClause.userId = userId;

        const [payments, reviewsCount] = await Promise.all([
            prisma.payment.findMany({
                where: whereClause,
                select: { amount: true }
            }),
            prisma.review.count({ where: whereClause })
        ]);

        const totalAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const cashback = payments.reduce(
            (sum, p) => sum + (Math.abs(Number(p.amount) || 0) * CASHBACK_RATE),
            0
        );

        return res.json({
            transactionsCount: payments.length,
            transactionAmount: Number(totalAmount.toFixed(2)),
            cashbackAmount: Number(cashback.toFixed(2)),
            reviewsCount
        });
    } catch (err) {
        return handleError(res, 'getTodaySummary', err);
    }
}

export async function getDailyTransactions(req, res) {
    try {
        const schema = Joi.object({
            userId: Joi.string().optional(),
            range: Joi.string().optional(),
            from: Joi.date().optional(),
            to: Joi.date().optional()
        });

        const { error, value } = schema.validate(req.query);
        if (error) return res.status(400).json({ error: error.message });

        const { userId, range } = value;
        const parsed = parseRange(range, value.from, value.to);
        const { from, to, fromDayjs, toDayjs } = parsed;

        const whereClause = { createdAt: { gte: from, lte: to } };
        if (userId) whereClause.userId = userId;

        const payments = await prisma.payment.findMany({
            where: whereClause,
            orderBy: { createdAt: 'asc' }
        });

        const daysRaw = toDayjs.diff(fromDayjs, 'day') + 1;
        const days = Math.max(1, daysRaw);
        const dailyMap = {};

        for (let i = 0; i < days; i++) {
            const dayJs = fromDayjs.add(i, 'day');
            const d = dayJs.format('YYYY-MM-DD');
            dailyMap[d] = { date: d, day: dayJs.format('dddd'), count: 0, totalAmount: 0 };
        }

        payments.forEach(p => {
            const k = dayjs(p.createdAt).format('YYYY-MM-DD');
            if (!dailyMap[k]) {
                const dayJs = dayjs(k);
                dailyMap[k] = { date: k, day: dayJs.format('dddd'), count: 0, totalAmount: 0 };
            }
            dailyMap[k].count += 1;
            dailyMap[k].totalAmount += Number(p.amount) || 0;
        });

        return res.json({
            period: {
                from: fromDayjs.toISOString(),
                to: toDayjs.toISOString(),
                periodDisplay: `${fromDayjs.format('DD MMM')} - ${toDayjs.format('DD MMM')}`
            },
            daily: Object.values(dailyMap).map(d => ({
                ...d,
                totalAmount: Number(d.totalAmount.toFixed(2))
            }))
        });
    } catch (err) {
        return handleError(res, 'getDailyTransactions', err);
    }
}

export async function getSpendingByCategory(req, res) {
    try {
        const schema = Joi.object({
            userId: Joi.string().optional(),
            range: Joi.string().optional(),
            from: Joi.date().optional(),
            to: Joi.date().optional()
        });

        const { error, value } = schema.validate(req.query);
        if (error) return res.status(400).json({ error: error.message });

        const { userId, range } = value;
        const parsed = parseRange(range, value.from, value.to);
        const { from, to } = parsed;

        const whereClause = { createdAt: { gte: from, lte: to } };
        if (userId) whereClause.userId = userId;

        const payments = await prisma.payment.findMany({
            where: whereClause,
            include: { shop: { include: { category: true } } }
        });

        const categoryAgg = {};
        payments.forEach(p => {
            const cat = p.shop?.category?.name || 'Unknown';
            categoryAgg[cat] = (categoryAgg[cat] || 0) + (Number(p.amount) || 0);
        });

        const total = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        let spendingByCategory = [];

        if (total > 0) {
            const entries = Object.entries(categoryAgg).map(([category, amount]) => {
                const pct = (amount / total) * 100;
                return {
                    category,
                    amount: Number(amount.toFixed(2)),
                    percentage: Number(pct.toFixed(2)),
                    percentageDisplay: `${Math.round(pct)}%`
                };
            });

            spendingByCategory = entries;
        } else {
            spendingByCategory = Object.entries(categoryAgg).map(([category, amount]) => ({
                category,
                amount: Number(amount.toFixed(2)),
                percentage: 0,
                percentageDisplay: '0%'
            }));
        }

        return res.json({ spendingByCategory });
    } catch (err) {
        return handleError(res, 'getSpendingByCategory', err);
    }
}

/**
 * GET /api/reports/cashback
 * Query: userId (optional), range/from/to
 * Returns daily cashback (derived) + list of cashback entries
 */
export async function cashbackSummary(req, res) {
    try {
        const schema = Joi.object({
            userId: Joi.string().optional(),
            range: Joi.string().optional(),
            from: Joi.date().optional(),
            to: Joi.date().optional()
        });
        const { error, value } = schema.validate(req.query);
        if (error) return res.status(400).json({ error: error.message });

        const { userId, range } = value;
        const { from, to, fromDayjs, toDayjs } = parseRange(range, value.from, value.to);

        // Build where clause for payments
        const paymentWhere = { createdAt: { gte: from, lte: to } };
        if (userId) paymentWhere.userId = userId;

        const payments = await prisma.payment.findMany({
            where: paymentWhere,
            include: { shop: true },
            orderBy: { createdAt: 'asc' }
        });

        // Prepare daily buckets (now summing original transaction amounts)
        const days = toDayjs.diff(fromDayjs, 'day') + 1;
        const daily = [];
        for (let i = 0; i < days; i++) {
            const d = fromDayjs.add(i, 'day');
            daily.push({
                date: d.format('YYYY-MM-DD'),
                dayName: d.format('dddd'), // Full name e.g. "Sunday"
                dayShort: d.format('ddd'), // Short name e.g. "Sun"
                amount: 0                  // raw numeric total transaction amount for that day
            });
        }

        const dailyIndex = Object.fromEntries(daily.map((d, i) => [d.date, i]));

        // currency formatter (en-IN) for display strings
        const nf = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
        const formatCurrency = (v) => {
            const num = Number(v) || 0;
            let s = nf.format(num); // e.g. "₹75.00"
            if (s.startsWith('₹') && s[1] !== ' ') s = '₹ ' + s.slice(1); // "₹ 75.00"
            if (s.endsWith('.00')) s = s.slice(0, -3); // remove ".00"
            return s;
        };

        const cashbackList = [];

        for (const p of payments) {
            const amount = Number(p.amount) || 0;
            const cb = Number(((amount * (typeof CASHBACK_RATE !== 'undefined' ? CASHBACK_RATE : 0.1))).toFixed(2)); // numeric cashback
            const key = dayjs(p.createdAt).format('YYYY-MM-DD');

            // accumulate raw transaction amount into daily bucket (for graph)
            if (dailyIndex[key] !== undefined) {
                daily[dailyIndex[key]].amount += amount;
            }

            // push cashback list item (still include cashback info per payment)
            if (cb > 0) {
                const shopLogo = p.shop?.logo || p.shop?.logoUrl || p.shop?.imageUrl || null;
                cashbackList.push({
                    id: p.id,
                    userId: p.userId,
                    shopId: p.shopId,
                    shopName: p.shop?.name || null,
                    shopLogo,
                    amount: amount,                     // numeric original transaction amount
                    cashbackAmount: cb,                 // numeric cashback
                    // formatted date like: "April 5, 25 at 2.07 PM"
                    dateDisplay: dayjs(p.createdAt).format('MMMM D, YY [at] h.mm A'),
                    createdAt: p.createdAt
                });
            }
        }

        // Normalize daily amounts (round to 2 decimals if needed)
        for (const d of daily) {
            d.amount = Number(Number(d.amount).toFixed(2));
            // optionally convert to integer if no decimals:
            // if (Number.isInteger(d.amount)) d.amount = Math.trunc(d.amount);
        }

        return res.json({
            period: { from: fromDayjs.toISOString(), to: toDayjs.toISOString(), periodDisplay: `${fromDayjs.format('DD MMM')} - ${toDayjs.format('DD MMM')}` },
            daily,
            cashbackList
        });
    } catch (err) {
        return handleError(res, 'cashbackSummary', err);
    }
}

/**
 * POST /api/reports/payments
 * Body: { userId, shopId, menuId?, menuName?, amount, txnRef?, status?, createdAt? }
 */
// export async function createPayment(req, res) {
//     try {
//         const schema = Joi.object({
//             userId: Joi.string().required(),
//             shopId: Joi.string().required(),
//             menuId: Joi.string().allow(null).optional(),
//             menuName: Joi.string().allow(null).optional(),
//             amount: Joi.number().required(),
//             txnRef: Joi.string().allow(null).optional(),
//             status: Joi.string().valid('PENDING', 'SUCCESS', 'FAILED').default('SUCCESS'),
//             createdAt: Joi.date().optional()
//         });
//         const { error, value } = schema.validate(req.body);
//         if (error) return res.status(400).json({ error: error.message });

//         const data = {
//             userId: value.userId,
//             shopId: value.shopId,
//             menuId: value.menuId || null,
//             menuName: value.menuName || null,
//             amount: value.amount,
//             txnRef: value.txnRef || null,
//             status: value.status
//         };
//         if (value.createdAt) data.createdAt = new Date(value.createdAt);

//         const payment = await prisma.payment.create({ data });
//         return res.status(201).json(payment);
//     } catch (err) {
//         return handleError(res, 'createPayment', err);
//     }
// }

/**
 * GET /api/reports/payments
 * Query: userId, shopId, status, from, to, page, limit
 * Adds derived cashbackAmount to each row
 */
export async function listPayments(req, res) {
    try {
        const schema = Joi.object({
            userId: Joi.string().optional(),
            shopId: Joi.string().optional(),
            status: Joi.string().valid('PENDING', 'SUCCESS', 'FAILED').optional(),
            from: Joi.date().optional(),
            to: Joi.date().optional(),
            page: Joi.number().min(1).default(1),
            limit: Joi.number().min(1).max(200).default(50)
        }).unknown(true);

        const { error, value } = schema.validate(req.query);
        if (error) return res.status(400).json({ error: error.message });

        const where = {};
        if (value.userId) where.userId = value.userId;
        if (value.shopId) where.shopId = value.shopId;
        if (value.status) where.status = value.status;
        if (value.from || value.to) {
            where.createdAt = {};
            if (value.from) where.createdAt.gte = new Date(value.from);
            if (value.to) where.createdAt.lte = new Date(value.to);
        }

        const total = await prisma.payment.count({ where });

        const rows = await prisma.payment.findMany({
            where,
            include: { shop: true },
            orderBy: { createdAt: 'desc' },
            skip: (value.page - 1) * value.limit,
            take: value.limit
        });

        // Aggregate daily totals for graph
        // Get date range for aggregation
        const fromDayjs = value.from ? dayjs(value.from) : dayjs().subtract(6, 'day').startOf('day');
        const toDayjs = value.to ? dayjs(value.to) : dayjs().endOf('day');
        const daysCount = toDayjs.diff(fromDayjs, 'day') + 1;

        // Initialize daily buckets
        const daily = [];
        for (let i = 0; i < daysCount; i++) {
            const d = fromDayjs.add(i, 'day');
            daily.push({
                date: d.format('YYYY-MM-DD'),
                dayName: d.format('dddd'),
                dayShort: d.format('ddd'),
                amount: 0
            });
        }
        const dailyIndex = Object.fromEntries(daily.map((d, i) => [d.date, i]));

        // Fetch all payments in date range for aggregation (without pagination)
        const paymentsForAggregation = await prisma.payment.findMany({
            where,
            select: { amount: true, createdAt: true }
        });

        for (const p of paymentsForAggregation) {
            const key = dayjs(p.createdAt).format('YYYY-MM-DD');
            if (dailyIndex[key] !== undefined) {
                daily[dailyIndex[key]].amount += Number(p.amount) || 0;
            }
        }

        // Round daily amounts to 2 decimals
        for (const d of daily) {
            d.amount = Number(d.amount.toFixed(2));
        }

        // currency formatter for display strings
        const nf = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formatCurrency = (v) => {
            const num = Number(v) || 0;
            let s = nf.format(num);
            if (s.startsWith('₹') && s[1] !== ' ') s = '₹ ' + s.slice(1);
            return s;
        };

        const data = [];
        let pageTotalAmount = 0;
        let pageTotalCashback = 0;

        for (const p of rows) {
            const rawAmount = Number(p.amount) || 0;
            let isDebit = true;
            if (typeof p.type === 'string') {
                const t = p.type.toLowerCase();
                if (t === 'credit' || t === 'in' || t === 'incoming') isDebit = false;
                if (t === 'debit' || t === 'out' || t === 'outgoing') isDebit = true;
            } else if (typeof p.direction === 'string') {
                const d = p.direction.toLowerCase();
                if (d === 'in' || d === 'credit') isDebit = false;
                if (d === 'out' || d === 'debit') isDebit = true;
            } else {
                if (rawAmount < 0) isDebit = false;
                else isDebit = true;
            }

            const amountAbs = Math.abs(rawAmount);
            const cashbackAmount = Number(((amountAbs * (typeof CASHBACK_RATE !== 'undefined' ? CASHBACK_RATE : 0.1))).toFixed(2));
            const amountDisplay = `${isDebit ? '- ' : '+ '}${formatCurrency(amountAbs)}`;
            const shopLogo = p.shop?.logo || p.shop?.logoUrl || p.shop?.imageUrl || null;

            data.push({
                id: p.id,
                userId: p.userId,
                shopId: p.shopId,
                shopName: p.shop?.name || null,
                shopLogo,
                status: p.status,
                amount: rawAmount,
                cashbackAmount,
                amountDisplay,
                dateDisplay: dayjs(p.createdAt).format('MMMM D, YY [at] h.mm A'),
                createdAt: p.createdAt,
                color: isDebit ? 'negative' : 'positive',
                isDebit
            });

            pageTotalAmount += rawAmount;
            pageTotalCashback += cashbackAmount;
        }

        pageTotalAmount = Number(pageTotalAmount.toFixed(2));
        pageTotalCashback = Number(pageTotalCashback.toFixed(2));

        return res.json({
            total,
            page: value.page,
            limit: value.limit,
            pageTotalAmount,
            pageTotalCashback,
            daily,
            data
        });
    } catch (err) {
        return handleError(res, 'listPayments', err);
    }
}

/**
 * GET /api/reports/transactions
 * Query: userId, shopId, status, dateRange (today,last7days,last30days,last90days,custom),
 *        from, to, amountBucket (upto200,200-500,500-2000,above2000), page, limit
 */
export async function listTransactions(req, res) {
    try {
        // Joi schema with rename aliases for backward compatibility
        const schema = Joi.object({
            userId: Joi.string().optional(),
            shopId: Joi.string().optional(),
            status: Joi.string().valid('PENDING', 'SUCCESS', 'FAILED').optional(),
            dateRange: Joi.string().valid('today', 'last7days', 'last30days', 'last90days', 'custom').optional(),
            from: Joi.date().optional(),
            to: Joi.date().optional(),
            amountBucket: Joi.string().valid('upto200', '200-500', '500-2000', 'above2000').optional(),
            page: Joi.number().min(1).default(1),
            limit: Joi.number().min(1).max(500).default(100)
        })
            .unknown(true)
            // allow legacy query params: ?range=today or ?r=today
            .rename('range', 'dateRange', { ignoreUndefined: true, override: true })
            .rename('r', 'dateRange', { ignoreUndefined: true, override: false });

        const { error, value } = schema.validate(req.query);
        if (error) return res.status(400).json({ error: error.message });

        // Build WHERE clause (applied to both paginated list and aggregation)
        const where = {};
        if (value.userId) where.userId = value.userId;
        if (value.shopId) where.shopId = value.shopId;
        if (value.status) where.status = value.status;

        // Determine date range from dateRange or explicit from/to
        let fromDayjs = null;
        let toDayjs = null;
        const now = dayjs();

        if (value.dateRange) {
            switch (value.dateRange) {
                case 'today':
                    fromDayjs = now.startOf('day');
                    toDayjs = now.endOf('day');
                    break;
                case 'last7days':
                    fromDayjs = now.subtract(6, 'day').startOf('day'); // include today => 7 days
                    toDayjs = now.endOf('day');
                    break;
                case 'last30days':
                    fromDayjs = now.subtract(29, 'day').startOf('day');
                    toDayjs = now.endOf('day');
                    break;
                case 'last90days':
                    fromDayjs = now.subtract(89, 'day').startOf('day');
                    toDayjs = now.endOf('day');
                    break;
                case 'custom':
                    fromDayjs = value.from ? dayjs(value.from).startOf('day') : null;
                    toDayjs = value.to ? dayjs(value.to).endOf('day') : null;
                    break;
            }
        } else if (value.from || value.to) {
            fromDayjs = value.from ? dayjs(value.from).startOf('day') : null;
            toDayjs = value.to ? dayjs(value.to).endOf('day') : null;
        }

        // If either date bound exists, apply to WHERE
        if (fromDayjs || toDayjs) {
            where.createdAt = {};
            if (fromDayjs) where.createdAt.gte = fromDayjs.toDate();
            if (toDayjs) where.createdAt.lte = toDayjs.toDate();
        }

        // Amount bucket mapping
        if (value.amountBucket) {
            switch (value.amountBucket) {
                case 'upto200':
                    where.amount = { lte: 200 };
                    break;
                case '200-500':
                    where.amount = { gt: 200, lte: 500 };
                    break;
                case '500-2000':
                    where.amount = { gt: 500, lte: 2000 };
                    break;
                case 'above2000':
                    where.amount = { gt: 2000 };
                    break;
            }
        }

        // Pagination + main list
        const page = Number(value.page) || 1;
        const limit = Number(value.limit) || 100;

        const total = await prisma.payment.count({ where });

        const rows = await prisma.payment.findMany({
            where,
            include: { shop: true },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        });

        // Aggregation range: default to last 7 days if none specified
        let aggFrom = fromDayjs ? fromDayjs.startOf('day') : dayjs().subtract(6, 'day').startOf('day');
        let aggTo = toDayjs ? toDayjs.endOf('day') : dayjs().endOf('day');

        // Defensive: if aggTo < aggFrom swap them
        if (aggTo.isBefore(aggFrom)) {
            const tmp = aggFrom;
            aggFrom = aggTo;
            aggTo = tmp;
        }

        // Ensure at least one day
        const daysCountRaw = aggTo.diff(aggFrom, 'day') + 1;
        const daysCount = Math.max(1, daysCountRaw);

        // Build daily buckets
        const daily = [];
        for (let i = 0; i < daysCount; i++) {
            const d = aggFrom.add(i, 'day');
            daily.push({
                date: d.format('YYYY-MM-DD'),
                dayName: d.format('dddd'),
                dayShort: d.format('ddd'),
                amount: 0
            });
        }
        const dailyIndex = Object.fromEntries(daily.map((d, i) => [d.date, i]));

        // Fetch all payments matching same WHERE (no pagination) but only select amount + createdAt
        const paymentsForAggregation = await prisma.payment.findMany({
            where,
            select: { amount: true, createdAt: true }
        });

        for (const p of paymentsForAggregation) {
            const key = dayjs(p.createdAt).format('YYYY-MM-DD');
            if (dailyIndex[key] !== undefined) {
                daily[dailyIndex[key]].amount += Number(p.amount) || 0;
            }
        }

        // Round daily amounts
        for (const d of daily) d.amount = Number(d.amount.toFixed(2));

        // Currency formatter
        const nf = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formatCurrency = (v) => {
            const num = Number(v) || 0;
            let s = nf.format(num);
            if (s.startsWith('₹') && s[1] !== ' ') s = '₹ ' + s.slice(1);
            return s;
        };

        // Build response rows and totals
        const data = [];
        let pageTotalAmount = 0;
        let pageTotalCashback = 0;

        for (const p of rows) {
            const rawAmount = Number(p.amount) || 0;

            // Determine debit/credit heuristics (adjust if your schema uses canonical fields)
            let isDebit = true;
            if (typeof p.type === 'string') {
                const t = p.type.toLowerCase();
                if (t === 'credit' || t === 'in' || t === 'incoming') isDebit = false;
                if (t === 'debit' || t === 'out' || t === 'outgoing') isDebit = true;
            } else if (typeof p.direction === 'string') {
                const d = p.direction.toLowerCase();
                if (d === 'in' || d === 'credit') isDebit = false;
                if (d === 'out' || d === 'debit') isDebit = true;
            } else {
                // fallback: positive amount -> debit (spent), negative -> credit (refund)
                if (rawAmount < 0) isDebit = false;
                else isDebit = true;
            }

            const amountAbs = Math.abs(rawAmount);
            const cashbackAmount = Number((amountAbs * CASHBACK_RATE).toFixed(2));
            const amountDisplay = `${isDebit ? '- ' : '+ '}${formatCurrency(amountAbs)}`;
            const shopLogo = p.shop?.logo || p.shop?.logoUrl || p.shop?.imageUrl || null;

            data.push({
                id: p.id,
                userId: p.userId,
                shopId: p.shopId,
                shopName: p.shop?.name || null,
                shopLogo,
                status: p.status,
                amount: rawAmount,
                cashbackAmount,
                amountDisplay,
                dateDisplay: dayjs(p.createdAt).format('MMMM D, YY [at] h.mm A'),
                createdAt: p.createdAt,
                color: isDebit ? 'negative' : 'positive',
                isDebit
            });

            pageTotalAmount += rawAmount;
            pageTotalCashback += cashbackAmount;
        }

        pageTotalAmount = Number(pageTotalAmount.toFixed(2));
        pageTotalCashback = Number(pageTotalCashback.toFixed(2));

        return res.json({
            total,
            page,
            limit,
            pageTotalAmount,
            pageTotalCashback,
            daily,
            data
        });
    } catch (err) {
        return handleError(res, 'listTransactions', err);
    }
}

/**
 * GET /api/reports/transactions/summary
 * Query: userId (optional), days (1..90, default 7)
 * Returns per-day counts/amount and time-slot breakdowns
 */
// export async function transactionsSummary(req, res) {
//     try {
//         const schema = Joi.object({
//             userId: Joi.string().optional(),
//             days: Joi.number().min(1).max(90).default(7)
//         });
//         const { error, value } = schema.validate(req.query);
//         if (error) return res.status(400).json({ error: error.message });

//         const days = value.days;
//         const end = dayjs().endOf('day');
//         const start = end.subtract(days - 1, 'day').startOf('day');

//         const where = { createdAt: { gte: start.toDate(), lte: end.toDate() } };
//         if (value.userId) where.userId = value.userId;

//         const payments = await prisma.payment.findMany({ where, include: { shop: true } });

//         const dayBuckets = [];
//         for (let i = 0; i < days; i++) {
//             const d = start.add(i, 'day');
//             dayBuckets.push({
//                 date: d.format('YYYY-MM-DD'),
//                 count: 0,
//                 amount: 0,
//                 slots: { '0-6': 0, '6-12': 0, '12-18': 0, '18-24': 0 }
//             });
//         }
//         const dayMap = Object.fromEntries(dayBuckets.map(d => [d.date, d]));

//         payments.forEach(p => {
//             const d = dayjs(p.createdAt);
//             const key = d.format('YYYY-MM-DD');
//             const bucket = dayMap[key];
//             if (!bucket) return;
//             bucket.count += 1;
//             bucket.amount += (p.amount || 0);
//             const hour = d.hour();
//             if (hour >= 0 && hour < 6) bucket.slots['0-6']++;
//             else if (hour < 12) bucket.slots['6-12']++;
//             else if (hour < 18) bucket.slots['12-18']++;
//             else bucket.slots['18-24']++;
//         });

//         return res.json({ period: { start: start.toISOString(), end: end.toISOString() }, days: Object.values(dayMap) });
//     } catch (err) {
//         return handleError(res, 'transactionsSummary', err);
//     }
// }

/**
 * GET /api/reports/reviews/count
 * Query: userId, shopId, range/from/to
 */
// export async function reviewsCount(req, res) {
//     try {
//         const schema = Joi.object({
//             userId: Joi.string().optional(),
//             shopId: Joi.string().optional(),
//             range: Joi.string().optional(),
//             from: Joi.date().optional(),
//             to: Joi.date().optional()
//         });
//         const { error, value } = schema.validate(req.query);
//         if (error) return res.status(400).json({ error: error.message });

//         const { range } = value;
//         const { from, to } = parseRange(range, value.from, value.to);

//         const where = { createdAt: { gte: from, lte: to } };
//         if (value.userId) where.userId = value.userId;
//         if (value.shopId) where.shopId = value.shopId;

//         const total = await prisma.review.count({ where });
//         return res.json({ total });
//     } catch (err) {
//         return handleError(res, 'reviewsCount', err);
//     }
// }