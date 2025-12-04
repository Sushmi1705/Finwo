import Joi from 'joi';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Haversine distance (km), rounded to 2 decimals
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (
        lat1 == null ||
        lon1 == null ||
        lat2 == null ||
        lon2 == null ||
        Number.isNaN(lat1) ||
        Number.isNaN(lon1) ||
        Number.isNaN(lat2) ||
        Number.isNaN(lon2)
    ) {
        return null;
    }
    const R = 6371; // Earth radius km
    const toRad = deg => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
};

/**
 * Returns bounding box (minLat, maxLat, minLng, maxLng) for given center and radiusKm.
 * Uses approximate formula (1 deg latitude ≈ 111 km).
 */
const getBoundingBox = (lat, lng, radiusKm) => {
    const latRad = (lat * Math.PI) / 180;
    const degLatKm = 111.32; // approx
    const degLngKm = Math.abs(Math.cos(latRad) * 111.32) || 111.32;
    const latDelta = radiusKm / degLatKm;
    const lngDelta = radiusKm / degLngKm;
    return {
        minLat: lat - latDelta,
        maxLat: lat + latDelta,
        minLng: lng - lngDelta,
        maxLng: lng + lngDelta,
    };
};

/**
 * GET /api/places/saved
 * Query params:
 *  - userId (required)
 *  - lat, lng (optional) to compute distance and bounding box filter
 *  - radius (km) optional, default 7
 *  - limit (max shops to return) optional default 100
 *  - sortBy: 'distance'|'rating'|'recent' optional (applies within each category)
 */
export async function getSavedPlaces(req, res) {
    try {
        const schema = Joi.object({
            userId: Joi.string().required(),
            lat: Joi.number().optional(),
            lng: Joi.number().optional(),
            radius: Joi.number().min(0).optional().default(7),
            limit: Joi.number().integer().min(1).max(500).optional().default(100),
            sortBy: Joi.string().valid('distance', 'rating', 'recent').optional().default('distance'),
            filterByRadius: Joi.boolean().optional().default(false), // new: whether to restrict by radius
        });

        const { error, value } = schema.validate(req.query);
        if (error) return res.status(400).json({ error: error.message });

        const { userId, lat, lng, radius, limit, sortBy, filterByRadius } = value;

        // 1. Get saved shop ids for user
        const savedRows = await prisma.savedShop.findMany({
            where: { userId },
            select: { shopId: true, savedAt: true },
            orderBy: { savedAt: 'desc' },
            take: 5000, // safety cap for very large saved lists
        });

        if (!savedRows || savedRows.length === 0) {
            return res.json({ totalSaved: 0, categories: [] });
        }
        const savedShopIds = savedRows.map(r => r.shopId);

        // 2. Fetch shops (no bounding-box prefilter). We will optionally filter by radius later.
        const shops = await prisma.shop.findMany({
            where: { id: { in: savedShopIds }, isActive: true },
            select: {
                id: true,
                name: true,
                description: true,
                address: true,
                city: true,
                latitude: true,
                longitude: true,
                logoUrl: true,
                openHours: true,
                phoneNumber: true,
                createdAt: true,
                category: { select: { id: true, name: true } },
                images: { where: { isPrimary: true }, select: { imageUrl: true }, take: 1 },
                menus: { where: { isAvailable: true }, select: { price: true }, take: 200 },
                offers: { where: { isActive: true }, select: { id: true, title: true, description: true, validFrom: true, validTo: true }, take: 5 },
            },
        });

        // 3. Fetch review aggregates for all shops in one query (only approved reviews)
        const reviewAggregates = await prisma.review.groupBy({
            by: ['shopId'],
            where: { shopId: { in: savedShopIds }, isApproved: true },
            _count: { rating: true },
            _avg: { rating: true },
        });
        const reviewMap = new Map();
        for (const agg of reviewAggregates) {
            const avg = agg._avg.rating ?? 0;
            const avgNum = Math.max(0, Math.min(5, Number(avg)));
            reviewMap.set(agg.shopId, {
                reviewsCount: agg._count.rating || 0,
                avgRating: Number(avgNum.toFixed(2)),
            });
        }

        // helper: format distance
        // formatDistance: returns a human-friendly string
        const formatDistance = (km) => {
            if (km == null || Number.isNaN(km)) return null;

            // < 1 km -> meters
            if (km < 1) {
                const meters = Math.round(km * 1000);
                return `${meters} m`;
            }

            // 1 <= km < 10 -> one decimal place (1.2 km, 4.8 km)
            if (km < 10) {
                // round to one decimal but remove trailing .0
                const v = Math.round(km * 10) / 10;
                return v % 1 === 0 ? `${v.toFixed(0)} km` : `${v.toFixed(1)} km`;
            }

            // >= 10 km -> integer km (10, 25, 120, 410)
            return `${Math.round(km)} km`;
        };

        // optional numeric rounding for distanceKm field you return
        const roundDistanceNumeric = (km) => {
            if (km == null || Number.isNaN(km)) return null;
            if (km < 1) return Number(km.toFixed(3));      // e.g. 0.450
            if (km < 10) return Number((Math.round(km * 10) / 10).toFixed(1)); // 1.2
            return Math.round(km);                        // integer for >=10
        };

        // helper: round to nearest half for display stars (if needed)
        const roundToHalf = (v) => Math.round(Math.max(0, Math.min(5, Number(v) || 0)) * 2) / 2;

        // 4. Process shops and compute distance (no filtering yet)
        const processed = shops.map(s => {
            const prices = (s.menus || []).map(m => (typeof m.price === 'number' ? m.price : null)).filter(p => p != null);
            const minPrice = prices.length ? Math.min(...prices) : null;
            const maxPrice = prices.length ? Math.max(...prices) : null;

            const agg = reviewMap.get(s.id) || { reviewsCount: 0, avgRating: 0 };
            const primaryImage = s.images && s.images.length ? s.images[0].imageUrl : s.logoUrl || null;

            let distanceKm = null;
            let distanceDisplay = null;
            let distanceKmRounded = null;
            if (lat != null && lng != null && s.latitude != null && s.longitude != null) {
                distanceKm = calculateDistance(lat, lng, s.latitude, s.longitude);
                distanceDisplay = formatDistance(distanceKm);
                distanceKmRounded = roundDistanceNumeric(distanceKm);
            }

            const ratingNumber = roundToHalf(agg.avgRating);

            return {
                id: s.id,
                name: s.name,
                description: s.description,
                address: s.address,
                city: s.city,
                latitude: s.latitude,
                longitude: s.longitude,
                imageUrl: primaryImage,
                openHours: s.openHours,
                phoneNumber: s.phoneNumber,
                createdAt: s.createdAt,
                ratingNumber,                         // e.g. 4.5
                ratingDisplay: ratingNumber % 1 === 0 ? `${ratingNumber}.0` : `${ratingNumber}`, // "4.5" or "4.0"
                ratingPercent: Math.round((agg.avgRating / 5) * 100),
                reviewsCount: agg.reviewsCount || 0,
                minPrice,
                maxPrice,
                offers: s.offers || [],
                category: s.category ? { id: s.category.id, name: s.category.name } : { id: null, name: 'Uncategorized' },
                distanceKm,                            // numeric, e.g. 1.234
                distanceDisplay, 
                distanceKmRounded,                      // formatted: "1.2 km" or "450 m" or null
                isSaved: true,
                savedAt: savedRows.find(r => r.shopId === s.id)?.savedAt || null,
            };
        });

        // 5. Optionally filter by radius only if filterByRadius === true and lat/lng provided
        let filtered = processed;
        if (filterByRadius && lat != null && lng != null) {
            filtered = processed.filter(p => p.distanceKm != null && p.distanceKm <= radius);
        }

        // 6. Sort (note: when sorting by distance and distance is null, those go last)
        const sortFn = (a, b) => {
            if (sortBy === 'rating') return (b.ratingNumber || 0) - (a.ratingNumber || 0);
            if (sortBy === 'recent') return new Date(b.savedAt || b.createdAt) - new Date(a.savedAt || a.createdAt);
            if (a.distanceKm == null && b.distanceKm == null) return 0;
            if (a.distanceKm == null) return 1;
            if (b.distanceKm == null) return -1;
            return a.distanceKm - b.distanceKm;
        };
        filtered.sort(sortFn);

        // 7. Limit and group by category
        const limited = filtered.slice(0, limit);
        const categoriesMap = new Map();
        for (const shop of limited) {
            const catId = shop.category.id || 'uncategorized';
            const catName = shop.category.name || 'Uncategorized';
            if (!categoriesMap.has(catId)) {
                categoriesMap.set(catId, { category: { id: catId, name: catName }, shops: [] });
            }
            categoriesMap.get(catId).shops.push(shop);
        }
        const categories = Array.from(categoriesMap.values());

        return res.json({
            totalSaved: savedRows.length,
            returnedCount: limited.length,
            categories,
        });
    } catch (err) {
        console.error('getSavedPlaces error', err);
        return res.status(500).json({ error: 'Failed to fetch saved places', message: err.message });
    }
}