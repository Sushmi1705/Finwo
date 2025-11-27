// src/controllers/compareController.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MAX_COMPARE = 2;

async function getOrCreateCompareList({ userId, sessionId }) {
    if (!userId && !sessionId) throw new Error('Missing identity (userId or sessionId required)');

    if (userId) {
        // findFirst works even if userId isn't declared @unique
        let list = await prisma.compareList.findFirst({ where: { userId } });
        if (!list) {
            list = await prisma.compareList.create({ data: { userId } });
        }
        return list;
    } else {
        let list = await prisma.compareList.findFirst({ where: { sessionId } });
        if (!list) {
            list = await prisma.compareList.create({ data: { sessionId } });
        }
        return list;
    }
}

export async function addToCompare(req, res) {
    try {
        const { userId, sessionId, shopId } = req.body;
        if (!shopId) return res.status(400).json({ error: 'shopId is required' });
        if (!userId && !sessionId) return res.status(400).json({ error: 'userId or sessionId is required' });

        // validate shop exists and is active
        const shop = await prisma.shop.findUnique({ where: { id: shopId } });
        if (!shop || !shop.isActive) return res.status(404).json({ error: 'Shop not found or inactive' });

        const list = await getOrCreateCompareList({ userId, sessionId });

        // fetch current compare items
        const items = await prisma.compareItem.findMany({
            where: { compareId: list.id },
            select: { shopId: true },
        });
        const shopIds = items.map(i => i.shopId);

        // already present
        if (shopIds.includes(shopId)) {
            const detailed = await prisma.compareItem.findMany({
                where: { compareId: list.id },
                include: { shop: { select: { id: true, name: true, logoUrl: true, avgRating: true } } },
            });
            return res.json({ status: 'ok', message: 'Already in compare', count: detailed.length, items: detailed.map(d => d.shop) });
        }

        if (shopIds.length < MAX_COMPARE) {
            // safe create
            await prisma.compareItem.create({ data: { compareId: list.id, shopId } });
            const updated = await prisma.compareItem.findMany({
                where: { compareId: list.id },
                include: { shop: { select: { id: true, name: true, logoUrl: true, avgRating: true } } },
            });
            return res.json({ status: 'ok', message: 'Added to compare', count: updated.length, items: updated.map(u => u.shop) });
        }

        // limit reached → ask client to replace
        return res.status(409).json({
            status: 'replace_required',
            message: `You already have ${MAX_COMPARE} shops in compare. Replace one?`,
            currentShopIds: shopIds,
        });
    } catch (err) {
        console.error('addToCompare error', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function replaceCompareItem(req, res) {
    try {
        const { userId, sessionId, oldShopId, newShopId } = req.body;
        if (!oldShopId || !newShopId) return res.status(400).json({ error: 'oldShopId and newShopId are required' });
        if (!userId && !sessionId) return res.status(400).json({ error: 'userId or sessionId is required' });

        // validate new shop
        const newShop = await prisma.shop.findUnique({ where: { id: newShopId } });
        if (!newShop || !newShop.isActive) return res.status(404).json({ error: 'New shop not found or inactive' });

        const list = await getOrCreateCompareList({ userId, sessionId });

        // transactionally replace
        await prisma.$transaction(async (tx) => {
            const oldItem = await tx.compareItem.findFirst({ where: { compareId: list.id, shopId: oldShopId } });
            if (!oldItem) throw new Error('Old shop not found in compare list');

            const exists = await tx.compareItem.findFirst({ where: { compareId: list.id, shopId: newShopId } });
            if (exists) {
                // if new item exists, just delete the old one
                await tx.compareItem.delete({ where: { id: oldItem.id } });
            } else {
                await tx.compareItem.delete({ where: { id: oldItem.id } });
                await tx.compareItem.create({ data: { compareId: list.id, shopId: newShopId } });
            }
        });

        const updated = await prisma.compareItem.findMany({
            where: { compareId: list.id },
            include: { shop: { select: { id: true, name: true, logoUrl: true, avgRating: true } } },
        });
        res.json({ status: 'ok', message: 'Replaced successfully', items: updated.map(u => u.shop) });
    } catch (err) {
        console.error('replaceCompareItem error', err);
        if (err.message === 'Old shop not found in compare list') {
            return res.status(404).json({ error: err.message });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function removeFromCompare(req, res) {
    try {
        const { userId, sessionId, shopId } = req.body;
        if (!shopId) return res.status(400).json({ error: 'shopId required' });
        if (!userId && !sessionId) return res.status(400).json({ error: 'userId or sessionId is required' });

        const list = await getOrCreateCompareList({ userId, sessionId });
        const item = await prisma.compareItem.findFirst({ where: { compareId: list.id, shopId } });
        if (!item) return res.status(404).json({ error: 'Shop not in compare list' });

        await prisma.compareItem.delete({ where: { id: item.id } });
        const updated = await prisma.compareItem.findMany({ where: { compareId: list.id }, include: { shop: { select: { id: true, name: true, logoUrl: true, avgRating: true } } } });
        res.json({ status: 'ok', message: 'Removed', items: updated.map(u => u.shop) });
    } catch (err) {
        console.error('removeFromCompare error', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function clearCompareList(req, res) {
    try {
        const { userId, sessionId } = req.body;
        if (!userId && !sessionId) return res.status(400).json({ error: 'userId or sessionId is required' });

        const list = await getOrCreateCompareList({ userId, sessionId });
        await prisma.compareItem.deleteMany({ where: { compareId: list.id } });
        res.json({ status: 'ok', message: 'Cleared' });
    } catch (err) {
        console.error('clearCompareList error', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function getCompareList(req, res) {
    try {
        const { userId, sessionId } = req.query;
        if (!userId && !sessionId) return res.status(400).json({ error: 'userId or sessionId is required' });

        const list = await getOrCreateCompareList({ userId, sessionId });

        const items = await prisma.compareItem.findMany({
            where: { compareId: list.id },
            include: { shop: { select: { id: true, name: true, logoUrl: true, avgRating: true } } },
            orderBy: { addedAt: 'asc' }
        });

        res.json({ status: 'ok', items: items.map(it => it.shop) });
    } catch (err) {
        console.error('getCompareList error', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// src/controllers/compareController.js
// src/controllers/compareController.js
export async function getCompareResult(req, res) {
    try {
        // Accept either explicit ids param or identity
        let shopIds = [];
        if (req.query.ids) {
            shopIds = req.query.ids.split(',').filter(Boolean);
        } else {
            const { userId, sessionId } = req.query;
            if (!userId && !sessionId) return res.status(400).json({ error: 'Provide ids or identity' });
            const list = await getOrCreateCompareList({ userId, sessionId });
            const items = await prisma.compareItem.findMany({ where: { compareId: list.id } });
            shopIds = items.map(i => i.shopId);
        }

        if (shopIds.length !== MAX_COMPARE) {
            return res.status(400).json({ error: `Comparison expects exactly ${MAX_COMPARE} shops` });
        }

        // Limits for inline lists in compare screen
        const REVIEWS_LIMIT = 10;
        const IMAGES_LIMIT = 8;
        const OFFERS_LIMIT = 5;

        // Fetch shops with limited related items. Use the relation names on your Shop model:
        const shops = await prisma.shop.findMany({
            where: { id: { in: shopIds } },
            include: {
                images: { select: { id: true, imageUrl: true }, take: IMAGES_LIMIT },
                offers: { where: { isActive: true }, select: { id: true, title: true, description: true, validFrom: true, validTo: true }, take: OFFERS_LIMIT },
                amenities: { select: { name: true } },
                // include full review objects (no select) — avoids unknown-field errors
                reviews: { orderBy: { createdAt: 'desc' }, take: REVIEWS_LIMIT }
            }
        });

        // Counts for each shop (totals)
        const countsByShop = {};
        await Promise.all(shopIds.map(async (id) => {
            const [reviewsCount, photosCount, offersCount] = await Promise.all([
                prisma.review.count({ where: { shopId: id } }),         // adjust model name if different
                prisma.shopImage.count({ where: { shopId: id } }),     // adjust model name if different
                prisma.shopOffer.count({ where: { shopId: id, isActive: true } }) // adjust model name if different
            ]);
            countsByShop[id] = { reviewsCount, photosCount, offersCount };
        }));

        // Build response in same order as shopIds
        const result = shopIds.map(id => {
            const s = shops.find(x => x.id === id);

            return {
                id: s.id,
                name: s.name,
                logoUrl: s.logoUrl || (s.images && s.images[0]?.imageUrl) || null,
                avgRating: s.avgRating,
                basicDetails: {
                    cuisine: s.cuisine || s.description || null,
                    openHours: s.openHours || null
                },
                locationDetails: {
                    address: s.address || null,
                    latitude: s.latitude,
                    longitude: s.longitude
                },
                // Inline previews
                reviewsPreview: s.reviews || [],   // full review objects (whatever fields your schema defines)
                photosPreview: s.images || [],
                offersPreview: s.offers || [],
                // Totals
                reviewsCount: countsByShop[id]?.reviewsCount || 0,
                photosCount: countsByShop[id]?.photosCount || 0,
                offersCount: countsByShop[id]?.offersCount || 0,
                amenities: (s.amenities || []).map(a => a.name)
            };
        });

        return res.json({ status: 'ok', shops: result });
    } catch (err) {
        console.error('getCompareResult error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}