import prisma from '../services/prismaClient.js';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
dayjs.extend(relativeTime);

/**
 * GET /api/transactions
 *
 * Query params:
 *  - userId (required)
 *  - status: completed | failed | processing | any
 *  - dateFilter: any | this_month | last_30 | last_90 | custom
 *  - from, to  (ISO date strings, used when dateFilter=custom)
 *  - amountFilter: any | upto_200 | 200_500 | 500_2000 | above_2000
 *  - minPrice, maxPrice  (optional numeric overrides)
 *  - limit (default 20), offset (default 0)
 *  - sort (default createdAt_desc) // extendable
 */
export async function getUserTransactions(req, res) {
  try {
    const {
      userId,
      status = 'any',
      dateFilter = 'any',
      from,
      to,
      amountFilter = 'any',
      minPrice,
      maxPrice,
      limit = '20',
      offset = '0',
      sort = 'createdAt_desc'
    } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }

    // parse pagination
    const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    const skip = Math.max(parseInt(offset, 10) || 0, 0);

    // status mapping
    const statusMap = {
      completed: 'SUCCESS',
      failed: 'FAILED',
      processing: 'PENDING',
    };

    const where = { userId };

    // status filter
    if (status && status !== 'any') {
      const mapped = statusMap[status];
      if (!mapped) {
        return res.status(400).json({ error: 'status must be one of completed, failed, processing, or any' });
      }
      where.status = mapped;
    }

    // date filter
    if (dateFilter && dateFilter !== 'any') {
      let fromDate = null;
      let toDate = null;
      const now = dayjs();

      switch (dateFilter) {
        case 'this_month':
          fromDate = now.startOf('month').toDate();
          toDate = now.endOf('day').toDate();
          break;
        case 'last_30':
          fromDate = now.subtract(30, 'day').startOf('day').toDate();
          toDate = now.endOf('day').toDate();
          break;
        case '  ':
          fromDate = now.subtract(90, 'day').startOf('day').toDate();
          toDate = now.endOf('day').toDate();
          break;
        case 'custom':
          if (!from && !to) {
            return res.status(400).json({ error: 'For custom dateFilter provide from and/or to (ISO date strings)' });
          }
          if (from) {
            const parsedFrom = dayjs(from);
            if (!parsedFrom.isValid()) return res.status(400).json({ error: 'Invalid from date' });
            fromDate = parsedFrom.startOf('day').toDate();
          }
          if (to) {
            const parsedTo = dayjs(to);
            if (!parsedTo.isValid()) return res.status(400).json({ error: 'Invalid to date' });
            toDate = parsedTo.endOf('day').toDate();
          }
          break;
        default:
          return res.status(400).json({ error: 'Unknown dateFilter. allowed: any, this_month, last_30, last_90, custom' });
      }

      if (fromDate && toDate) {
        where.createdAt = { gte: fromDate, lte: toDate };
      } else if (fromDate) {
        where.createdAt = { gte: fromDate };
      } else if (toDate) {
        where.createdAt = { lte: toDate };
      }
    }

    // amount filter (buckets)
    // bucket mapping returns min/max to overlap with payment amount
    const amountBuckets = {
      upto_200: { min: 0, max: 200 },
      '200_500': { min: 200, max: 500 },
      '500_2000': { min: 500, max: 2000 },
      above_2000: { min: 2000, max: Number.POSITIVE_INFINITY }
    };

    let minPriceVal = (typeof minPrice !== 'undefined' && minPrice !== '') ? Number(minPrice) : null;
    let maxPriceVal = (typeof maxPrice !== 'undefined' && maxPrice !== '') ? Number(maxPrice) : null;

    if (amountFilter && amountFilter !== 'any') {
      const bucket = amountBuckets[amountFilter];
      if (!bucket) {
        return res.status(400).json({ error: 'Invalid amountFilter; use any, upto_200, 200_500, 500_2000, above_2000' });
      }
      // prefer explicit minPrice/maxPrice over bucket if provided
      if (minPriceVal == null) minPriceVal = bucket.min;
      if (maxPriceVal == null && isFinite(bucket.max)) maxPriceVal = bucket.max;
    }

    // If minPrice/maxPrice supplied, filter by overlap:
    // We want payments whose amount falls within user's requested range
    // so we add where.amount >= minPriceVal and amount <= maxPriceVal
    if (minPriceVal != null || maxPriceVal != null) {
      where.AND = where.AND || [];
      if (minPriceVal != null && maxPriceVal != null) {
        if (isNaN(minPriceVal) || isNaN(maxPriceVal)) {
          return res.status(400).json({ error: 'minPrice/maxPrice must be numbers' });
        }
        where.AND.push({ amount: { gte: minPriceVal, lte: maxPriceVal } });
      } else if (minPriceVal != null) {
        if (isNaN(minPriceVal)) return res.status(400).json({ error: 'minPrice must be a number' });
        where.AND.push({ amount: { gte: minPriceVal } });
      } else if (maxPriceVal != null) {
        if (isNaN(maxPriceVal)) return res.status(400).json({ error: 'maxPrice must be a number' });
        where.AND.push({ amount: { lte: maxPriceVal } });
      }
    }

    // Sorting
    let orderBy = { createdAt: 'desc' };
    if (sort === 'amount_asc') orderBy = { amount: 'asc' };
    if (sort === 'amount_desc') orderBy = { amount: 'desc' };

    // Query DB: total count + paged rows
    const [total, rows] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: {
          shop: { select: { id: true, name: true, logoUrl: true } },
        },
        orderBy,
        skip,
        take,
      })
    ]);

    // Format results
    const items = rows.map(p => ({
      id: p.id,
      paymentId: p.id,
      shopId: p.shopId,
      shopName: p.shop?.name || null,
      shopLogo: p.shop?.logoUrl || null,
      menuId: p.menuId || null,
      menuName: p.menuName || null,
      amount: p.amount,
      status: String(p.status), // PENDING|SUCCESS|FAILED
      isReviewed: !!p.isReviewed,
      createdAt: p.createdAt,
      createdAtIso: p.createdAt?.toISOString(),
      createdAtReadable: p.createdAt ? dayjs(p.createdAt).format('DD MMM YYYY, h:mm A') : null,
      createdAtRelative: p.createdAt ? dayjs(p.createdAt).fromNow() : null,
    }));

    // Optional: quick aggregates for UI (buckets counts)
    const bucketCountsPromises = Object.entries(amountBuckets).map(async ([key, b]) => {
      const bucketWhere = {
        ...where,
        AND: [...(where.AND || [])]
      };
      // bucket: amount >= min and (amount <= max if finite)
      bucketWhere.AND.push({ amount: { gte: b.min } });
      if (isFinite(b.max)) bucketWhere.AND.push({ amount: { lte: b.max } });
      const cnt = await prisma.payment.count({ where: bucketWhere });
      return [key, cnt];
    });

    const bucketCountsArr = await Promise.all(bucketCountsPromises);
    const amountBucketCounts = Object.fromEntries(bucketCountsArr);

    return res.json({
      status: 'ok',
      total,
      limit: take,
      offset: skip,
      returned: items.length,
      filtersApplied: {
        status,
        dateFilter,
        from: from || null,
        to: to || null,
        amountFilter,
        minPrice: minPriceVal,
        maxPrice: maxPriceVal,
      },
      aggregates: {
        amountBuckets: amountBucketCounts
      },
      items
    });

  } catch (err) {
    console.error('getUserTransactions error', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}