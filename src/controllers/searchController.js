// src/controllers/searchController.js
import prisma from '../services/prismaClient.js';
import dayjs from 'dayjs';

/**
 * Calculate distance between two coordinates using Haversine formula
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return parseFloat(distance.toFixed(2));
};

/**
 * GLOBAL SEARCH SUGGESTIONS
 * Searches across: Shops, Categories, Menu Items
 * GET /api/search/suggestions?query=high
 */
export const getSearchSuggestions = async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || query.trim().length < 2) {
            return res.json({ query: query || '', suggestions: [] });
        }

        const searchTerm = query.trim();

        // 1. Search in shop names, descriptions, and addresses
        const shopSuggestions = await prisma.shop.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { name: { contains: searchTerm } },
                            { description: { contains: searchTerm } },
                            { address: { contains: searchTerm } },
                            { city: { contains: searchTerm } },
                        ],
                    },
                    { isActive: true },
                ],
            },
            select: {
                id: true,
                name: true,
            },
            take: 5,
        });

        // 2. Search in main categories
        const categorySuggestions = await prisma.mainCategory.findMany({
            where: {
                AND: [
                    { name: { contains: searchTerm } },
                    { isActive: true },
                ],
            },
            select: {
                id: true,
                name: true,
            },
            take: 3,
        });

        // 3. Search in menu items
        const menuItemSuggestions = await prisma.menu.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { itemName: { contains: searchTerm } },
                            { description: { contains: searchTerm } },
                            { categoryName: { contains: searchTerm } },
                        ],
                    },
                    { isAvailable: true },
                ],
            },
            select: {
                id: true,
                itemName: true,
                shopId: true,
            },
            take: 5,
        });

        // Combine suggestions with type information
        const allSuggestions = [
            ...shopSuggestions.map(s => ({
                id: s.id,
                name: s.name,
                type: 'shop',
            })),
            ...categorySuggestions.map(c => ({
                id: c.id,
                name: c.name,
                type: 'category',
            })),
            ...menuItemSuggestions.map(mi => ({
                id: mi.id,
                name: mi.itemName,
                type: 'menu_item',
                shopId: mi.shopId,
            })),
        ];

        // Remove duplicates based on name (case-insensitive)
        const seen = new Set();
        const uniqueSuggestions = allSuggestions
            .filter(item => {
                const key = item.name.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, 10);

        res.json({
            query: searchTerm,
            suggestions: uniqueSuggestions,
        });

    } catch (error) {
        console.error('Error getting search suggestions:', error);
        res.status(500).json({
            error: 'Failed to get search suggestions',
            message: error.message
        });
    }
};

/**
 * GLOBAL SEARCH - Search shops by query
 * Searches in: Shop data + Menu items + Location
 * Returns: List of shops with full details
 * GET /api/search/shops?query=high%20protein&lat=12.9&lng=80.2&radius=10&sortBy=distance&categoryId=xxx
 */

export const searchShops = async (req, res) => {
    try {
        const {
            query,
            lat,
            lng,
            radius,
            sortBy,
            categoryId,
            userId,
            chip,
            hoursFilter = 'any',      // any | openNow | custom
            customOpenFrom,           // e.g. "10:00"
            customOpenTo,             // e.g. "22:00"
            minRating,                // e.g. "4.0"
            minPrice,
            maxPrice,
        } = req.query;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const searchTerm = query.trim();
        const chipFilter = chip && chip !== 'All' ? chip.trim().toLowerCase() : null;
        const userLat = lat ? parseFloat(lat) : null;
        const userLng = lng ? parseFloat(lng) : null;
        let searchRadius = radius ? parseFloat(radius) : 7;
        const sortOption = sortBy || 'relevance';

        let minRatingVal = 0;
        if (minRating && minRating !== 'any') {
            minRatingVal = parseFloat(minRating);
            if (isNaN(minRatingVal) || minRatingVal < 0 || minRatingVal > 5) {
                return res.status(400).json({ error: 'minRating must be between 0 and 5 or "any"' });
            }
        }
        const minPriceVal = minPrice ? parseFloat(minPrice) : null;
        const maxPriceVal = maxPrice ? parseFloat(maxPrice) : null;

        // STEP 1: menu match
        const matchingMenus = await prisma.menu.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { itemName: { contains: searchTerm } },
                            { description: { contains: searchTerm } },
                            { categoryName: { contains: searchTerm } },
                        ],
                    },
                    { isAvailable: true },
                ],
            },
            select: { shopId: true },
        });

        const shopIdsFromMenus = [...new Set(matchingMenus.map(m => m.shopId))];

        // STEP 2: shop where clause
        const whereClause = {
            AND: [
                {
                    OR: [
                        { name: { contains: searchTerm } },
                        { description: { contains: searchTerm } },
                        { address: { contains: searchTerm } },
                        { city: { contains: searchTerm } },
                        ...(shopIdsFromMenus.length > 0
                            ? [{ id: { in: shopIdsFromMenus } }]
                            : []),
                    ],
                },
                { isActive: true },
            ],
        };

        if (categoryId) {
            whereClause.AND.push({ categoryId });
        }

        const shops = await prisma.shop.findMany({
            where: whereClause,
            include: {
                category: { select: { id: true, name: true } },
                reviews: { select: { rating: true } },
                menus: {
                    where: { isAvailable: true },
                    select: {
                        id: true,
                        itemName: true,
                        price: true,
                        categoryName: true,
                        imageUrl: true,
                    },
                },
            },
        });

        // saved shops
        let savedShopIds = [];
        if (userId) {
            const savedShops = await prisma.savedShop.findMany({
                where: { userId },
                select: { shopId: true },
            });
            savedShopIds = savedShops.map(s => s.shopId);
        }

        const calculateDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371;
            const dLat = ((lat2 - lat1) * Math.PI) / 180;
            const dLon = ((lon2 - lon1) * Math.PI) / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return parseFloat((R * c).toFixed(2));
        };

        const now = dayjs();

        const isShopOpenNow = openHoursStr => {
            // openHours: "10:00 AM - 9:00 PM" or "10:00-21:00"
            if (!openHoursStr) return false;
            try {
                let [from, to] = openHoursStr.split('-').map(s => s.trim());
                if (!from || !to) return false;

                // Try to parse flexible time formats via dayjs
                const today = now.format('YYYY-MM-DD');
                const open = dayjs(`${today} ${from}`);
                const close = dayjs(`${today} ${to}`);

                if (!open.isValid() || !close.isValid()) return false;
                return now.isAfter(open) && now.isBefore(close);
            } catch {
                return false;
            }
        };

        const isShopWithinCustomHours = (openHoursStr, fromTime, toTime) => {
            // No openHours in DB → cannot check, so treat as not matching for custom filter
            if (!openHoursStr) return false;

            try {
                let [shopFrom, shopTo] = openHoursStr.split('-').map(s => s.trim());
                if (!shopFrom || !shopTo) return false;

                const today = now.format('YYYY-MM-DD');
                const shopOpen = dayjs(`${today} ${shopFrom}`);
                const shopClose = dayjs(`${today} ${shopTo}`);

                if (!shopOpen.isValid() || !shopClose.isValid()) {
                    return false;
                }

                // CASE 1: both from and to provided → interval overlap
                if (fromTime && toTime) {
                    const customFrom = dayjs(`${today} ${fromTime}`);
                    const customTo = dayjs(`${today} ${toTime}`);

                    if (!customFrom.isValid() || !customTo.isValid()) return false;

                    // Require from < to for sanity
                    if (!customFrom.isBefore(customTo)) return false;

                    // overlap: [shopOpen, shopClose] ∩ [customFrom, customTo] ≠ ∅
                    return shopOpen.isBefore(customTo) && shopClose.isAfter(customFrom);
                }

                // CASE 2: only from provided → shop must be open at or after this time
                if (fromTime && !toTime) {
                    const customFrom = dayjs(`${today} ${fromTime}`);
                    if (!customFrom.isValid()) return false;

                    // Shop's closing time must be after the requested "from" time
                    return shopClose.isAfter(customFrom);
                }

                // CASE 3: only to provided → shop must be open at or before this time
                if (!fromTime && toTime) {
                    const customTo = dayjs(`${today} ${toTime}`);
                    if (!customTo.isValid()) return false;

                    // Shop's opening time must be before the requested "to" time
                    return shopOpen.isBefore(customTo);
                }

                // No from/no to → already handled above; but keep fallback
                return false;
            } catch {
                return false;
            }
        };

        // STEP 4: process + apply filters
        let processedShops = shops
            .map(shop => {
                const ratings = shop.reviews.map(r => r.rating);
                const averageRating =
                    ratings.length > 0
                        ? parseFloat(
                            (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1),
                        )
                        : 0;

                let distanceKm = null;
                if (userLat && userLng && shop.latitude && shop.longitude) {
                    distanceKm = calculateDistance(
                        userLat,
                        userLng,
                        shop.latitude,
                        shop.longitude,
                    );
                }

                const prices = shop.menus.map(m => m.price).filter(p => p != null);
                const minPriceShop = prices.length > 0 ? Math.min(...prices) : null;
                const maxPriceShop = prices.length > 0 ? Math.max(...prices) : null;

                const menuCategories = [
                    ...new Set(shop.menus.map(m => m.categoryName).filter(Boolean)),
                ];

                const tags = [
                    ...(shop.category?.name ? [shop.category.name] : []),
                    ...menuCategories,
                ];

                const featuredMenuItems = menuCategories.slice(0, 5).map(catName => {
                    const item = shop.menus.find(m => m.categoryName === catName);
                    return {
                        categoryName: catName,
                        imageUrl: item?.imageUrl || null,
                    };
                });

                const chipMenus = chipFilter
                    ? shop.menus.filter(
                        m =>
                            (m.categoryName &&
                                m.categoryName.toLowerCase() === chipFilter) ||
                            (m.itemName &&
                                m.itemName.toLowerCase().includes(chipFilter)),
                    )
                    : shop.menus;

                const hasChipMatch = chipFilter ? chipMenus.length > 0 : true;

                const isSaved = savedShopIds.includes(shop.id);

                const openNowFlag =
                    hoursFilter === 'openNow'
                        ? isShopOpenNow(shop.openHours)
                        : true;

                const customHoursFlag =
                    hoursFilter === 'custom'
                        ? isShopWithinCustomHours(shop.openHours, customOpenFrom, customOpenTo)
                        : true;  // ← Returns true because hoursFilter is 'any' 

                const ratingFlag = minRatingVal === 0 ? true : averageRating >= minRatingVal;

                const priceFlag =
                    (minPriceVal == null || (maxPriceShop != null && maxPriceShop >= minPriceVal)) &&
                    (maxPriceVal == null || (minPriceShop != null && minPriceShop <= maxPriceVal));

                // filter here
                if (!hasChipMatch || !openNowFlag || !customHoursFlag || !ratingFlag || !priceFlag) {
                    return null;
                }

                return {
                    id: shop.id,
                    name: shop.name,
                    description: shop.description,
                    address: shop.address,
                    city: shop.city,
                    latitude: shop.latitude,
                    longitude: shop.longitude,
                    imageUrl: shop.logoUrl,
                    rating: averageRating,
                    reviewsCount: shop.reviews.length,
                    distanceKm,
                    category: shop.category,
                    tags,
                    menuCategories,
                    featuredMenuItems,
                    minPrice: minPriceShop,
                    maxPrice: maxPriceShop,
                    openHours: shop.openHours,
                    contactNumber: shop.phoneNumber,
                    isSaved,
                    chipMenus,
                };
            })
            .filter(Boolean);

        // radius filter + smart expand (same as before)
        if (userLat && userLng) {
            processedShops = processedShops.filter(
                s => s.distanceKm !== null && s.distanceKm <= searchRadius,
            );
            if (processedShops.length < 5) {
                searchRadius = 15;
                processedShops = processedShops.filter(
                    s => s.distanceKm !== null && s.distanceKm <= searchRadius,
                );
            }
        }

        // Sort
        switch (sortOption) {
            case 'distance':
                processedShops.sort((a, b) => {
                    if (a.distanceKm === null) return 1;
                    if (b.distanceKm === null) return -1;
                    return a.distanceKm - b.distanceKm;
                });
                break;
            case 'rating':
                processedShops.sort((a, b) => b.rating - a.rating);
                break;
            case 'price':
                processedShops.sort((a, b) => {
                    if (a.minPrice == null) return 1;
                    if (b.minPrice == null) return -1;
                    return a.minPrice - b.minPrice;
                });
                break;
            case 'relevance':
            default:
                break;
        }

        const allMenuCategoriesSet = new Set();
        processedShops.forEach(shop => {
            shop.menuCategories.forEach(cat => allMenuCategoriesSet.add(cat));
        });
        const allMenuCategories = Array.from(allMenuCategoriesSet);

        // ✅ NEW: build category → first image map
        const categoryImageMap = {};
        shops.forEach(shop => {
            if (shop.menus && shop.menus.length) {
                shop.menus.forEach(menu => {
                    if (menu.categoryName && menu.imageUrl && !categoryImageMap[menu.categoryName]) {
                        categoryImageMap[menu.categoryName] = menu.imageUrl;
                    }
                });
            }
        });

        const allMenuCategoriesWithImages = allMenuCategories.map(name => ({
            name,
            imageUrl: categoryImageMap[name] || null
        }));

        res.json({
            query: searchTerm,
            chip: chipFilter || 'All',
            allMenuCategories: allMenuCategoriesWithImages,
            totalResults: processedShops.length,
            searchRadius,
            sortBy: sortOption,
            filters: {
                hoursFilter,
                customOpenFrom,
                customOpenTo,
                minRating: minRatingVal,
                minPrice: minPriceVal,
                maxPrice: maxPriceVal,
            },
            userLocation:
                userLat && userLng ? { lat: userLat, lng: userLng } : null,
            shops: processedShops,
        });
    } catch (error) {
        console.error('Error searching shops:', error);
        res.status(500).json({
            error: 'Failed to search shops',
            message: error.message,
        });
    }
};

/**
 * GET SHOP DETAIL (for when user clicks a shop from search results)
 * GET /api/search/shop/:id?lat=12.9&lng=80.2
 */
export const getShopSearchDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const { lat, lng } = req.query;

        const userLat = lat ? parseFloat(lat) : null;
        const userLng = lng ? parseFloat(lng) : null;

        const shop = await prisma.shop.findUnique({
            where: { id },
            include: {
                category: {
                    select: { id: true, name: true },
                },
                reviews: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    select: {
                        id: true,
                        rating: true,
                        comment: true,
                        createdAt: true,
                    },
                },
                menus: {
                    where: { isAvailable: true },
                    orderBy: { categoryName: 'asc' },
                    select: {
                        id: true,
                        itemName: true,
                        description: true,
                        price: true,
                        quantity: true,
                        imageUrl: true,
                        categoryName: true,
                    },
                },
            },
        });

        if (!shop || !shop.isActive) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        // Calculate distance
        let distanceKm = null;
        if (userLat && userLng && shop.latitude && shop.longitude) {
            distanceKm = calculateDistance(
                userLat,
                userLng,
                shop.latitude,
                shop.longitude
            );
        }

        // Calculate rating
        const ratings = shop.reviews.map(r => r.rating);
        const averageRating =
            ratings.length > 0
                ? parseFloat(
                    (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
                )
                : 0;

        // Group menu by categoryName
        const menuByCategory = {};
        shop.menus.forEach(m => {
            const key = m.categoryName || 'Others';
            if (!menuByCategory[key]) menuByCategory[key] = [];
            menuByCategory[key].push(m);
        });

        // Check if open now
        const now = dayjs();
        let isOpenNow = null;
        if (shop.openingTime && shop.closingTime) {
            try {
                const open = dayjs(now.format('YYYY-MM-DD') + ' ' + shop.openingTime);
                const close = dayjs(now.format('YYYY-MM-DD') + ' ' + shop.closingTime);
                isOpenNow = now.isAfter(open) && now.isBefore(close);
            } catch (err) {
                isOpenNow = null;
            }
        }

        res.json({
            id: shop.id,
            name: shop.name,
            description: shop.description,
            imageUrl: shop.imageUrl,
            address: shop.address,
            area: shop.area,
            city: shop.city,
            latitude: shop.latitude,
            longitude: shop.longitude,
            distanceKm,
            category: shop.category,
            rating: averageRating,
            reviewsCount: shop.reviews.length,
            reviews: shop.reviews,
            openingTime: shop.openingTime,
            closingTime: shop.closingTime,
            isOpenNow,
            contactNumber: shop.contactNumber,
            menuSections: Object.entries(menuByCategory).map(([categoryName, items]) => ({
                categoryName,
                items,
            })),
        });

    } catch (error) {
        console.error('Error getting shop search detail:', error);
        res.status(500).json({
            error: 'Failed to get shop detail',
            message: error.message,
        });
    }
};

/**
 * GET RECENT SEARCHES
 * GET /api/search/recent?userId=xxx
 */
export const getRecentSearches = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const recentSearches = await prisma.searchHistory.findMany({
            where: { userId },
            orderBy: { searchedAt: 'desc' },
            take: 10,
            select: {
                id: true,
                query: true,
                targetId: true,
                targetName: true,
                targetType: true,
                searchedAt: true,
            },
        });

        res.json({ searches: recentSearches });

    } catch (error) {
        console.error('Error getting recent searches:', error);
        res.status(500).json({
            error: 'Failed to get recent searches',
            message: error.message,
        });
    }
};

/**
 * SAVE SEARCH TO HISTORY
 * POST /api/search/recent
 * Body: { userId, query, targetId, targetName, targetType }
 */
export const saveSearchHistory = async (req, res) => {
    try {
        const { userId, query, targetId, targetName, targetType } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const trimmedQuery = query.trim();

        // Consider same search = same user + same text (ignoring target)
        const existingSearch = await prisma.searchHistory.findFirst({
            where: {
                userId,
                query: trimmedQuery,
            },
        });

        if (existingSearch) {
            await prisma.searchHistory.update({
                where: { id: existingSearch.id },
                data: {
                    targetId: targetId ?? existingSearch.targetId,
                    targetName: targetName ?? existingSearch.targetName,
                    targetType: targetType ?? existingSearch.targetType,
                    searchedAt: new Date(),
                },
            });
        } else {
            await prisma.searchHistory.create({
                data: {
                    userId,
                    query: trimmedQuery,
                    targetId: targetId || null,
                    targetName: targetName || null,
                    targetType: targetType || null,
                },
            });
        }

        res.json({ message: 'Search saved to history' });
    } catch (error) {
        console.error('Error saving search history:', error);
        res.status(500).json({
            error: 'Failed to save search history',
            message: error.message,
        });
    }
};

/**
 * DELETE ONE SEARCH FROM HISTORY
 * DELETE /api/search/recent/:id?userId=xxx
 */
export const deleteSearchHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const search = await prisma.searchHistory.findFirst({
            where: { id, userId },
        });

        if (!search) {
            return res.status(404).json({ error: 'Search history not found' });
        }

        await prisma.searchHistory.delete({
            where: { id },
        });

        res.json({ message: 'Search history deleted' });

    } catch (error) {
        console.error('Error deleting search history:', error);
        res.status(500).json({
            error: 'Failed to delete search history',
            message: error.message,
        });
    }
};

/**
 * CLEAR ALL SEARCH HISTORY
 * DELETE /api/search/recent?userId=xxx
 */
export const clearSearchHistory = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        await prisma.searchHistory.deleteMany({
            where: { userId },
        });

        res.json({ message: 'Search history cleared' });

    } catch (error) {
        console.error('Error clearing search history:', error);
        res.status(500).json({
            error: 'Failed to clear search history',
            message: error.message,
        });
    }
};