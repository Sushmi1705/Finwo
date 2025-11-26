import prisma from './prismaClient.js';

// ========================================
// DISTANCE CALCULATION HELPER
// ========================================

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
};

// ========================================
// BASE SHOP SELECT (for Prisma queries)
// ========================================

const baseShopSelect = {
    id: true,
    name: true,
    description: true,
    address: true,
    city: true,
    latitude: true,
    longitude: true,
    logoUrl: true,
    avgRating: true,
    reviewCount: true,
    openHours: true,
    phoneNumber: true,
    menus: {
        where: { isAvailable: true },
        select: {
            id: true,
            itemName: true,
            price: true,
            categoryName: true,
            imageUrl: true,
            isQuickSnack: true,
        },
    },
};

// Simple shop select without menus (for performance)
const simpleShopSelect = {
    id: true,
    name: true,
    description: true,
    address: true,
    city: true,
    latitude: true,
    longitude: true,
    logoUrl: true,
    avgRating: true,
    reviewCount: true,
    openHours: true,
    phoneNumber: true,
};

// ========================================
// FORMAT SHOP FOR CARD (common response format)
// ========================================

function formatShopForCard(shop) {
    const prices = shop.menus ? shop.menus.map((m) => m.price).filter((p) => p != null) : [];
    const minPrice = prices.length ? Math.min(...prices) : null;
    const maxPrice = prices.length ? Math.max(...prices) : null;

    const menuCategories = shop.menus
        ? [...new Set(shop.menus.map((m) => m.categoryName).filter(Boolean))]
        : [];

    return {
        id: shop.id,
        name: shop.name,
        description: shop.description,
        address: shop.address,
        city: shop.city,
        latitude: shop.latitude,
        longitude: shop.longitude,
        imageUrl: shop.logoUrl,
        rating: shop.avgRating ?? 0,
        reviewsCount: shop.reviewCount ?? 0,
        openHours: shop.openHours,
        contactNumber: shop.phoneNumber,
        minPrice,
        maxPrice,
        menuCategories,
    };
}

// Simple format without menu details
function formatShopSimple(shop) {
    return {
        id: shop.id,
        name: shop.name,
        description: shop.description,
        address: shop.address,
        city: shop.city,
        latitude: shop.latitude,
        longitude: shop.longitude,
        imageUrl: shop.logoUrl,
        rating: shop.avgRating ?? 0,
        reviewsCount: shop.reviewCount ?? 0,
        openHours: shop.openHours,
        contactNumber: shop.phoneNumber,
    };
}

// ========================================
// BEHAVIOUR IMPLEMENTATIONS
// ========================================

/**
 * NEAR_ME: Shows shops near user's location within a radius
 * Config: { radiusKm: number }
 */
async function behaviourNearMe({ userLat, userLng, radiusKm, config }) {
    const shops = await prisma.shop.findMany({
        where: { isActive: true },
        select: simpleShopSelect,
    });

    let processed = shops.map((s) => {
        let distanceKm = null;
        if (userLat && userLng && s.latitude && s.longitude) {
            distanceKm = calculateDistance(userLat, userLng, s.latitude, s.longitude);
        }
        return { ...formatShopSimple(s), distanceKm };
    });

    // Filter by radius if location provided
    if (userLat && userLng && radiusKm) {
        processed = processed
            .filter((s) => s.distanceKm !== null && s.distanceKm <= radiusKm)
            .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return processed;
}

/**
 * CATEGORY_BASED: Shows shops from a specific main category
 * Requires: mainCategoryId
 */
async function behaviourCategoryBased({ mainCategoryId, userLat, userLng, config }) {
    if (!mainCategoryId) {
        console.warn('CATEGORY_BASED behaviour called without mainCategoryId');
        return [];
    }

    const shops = await prisma.shop.findMany({
        where: { isActive: true, categoryId: mainCategoryId },
        select: simpleShopSelect,
    });

    return shops.map((s) => {
        let distanceKm = null;
        if (userLat && userLng && s.latitude && s.longitude) {
            distanceKm = calculateDistance(userLat, userLng, s.latitude, s.longitude);
        }
        return { ...formatShopSimple(s), distanceKm };
    });
}

/**
 * QUICK_SNACK: Returns list of quick snack items (not shops)
 * This is used to show the list of available quick snack menu items
 */
async function behaviourQuickSnackItems({ userLat, userLng, radiusKm, config }) {
    const menus = await prisma.menu.findMany({
        where: {
            isAvailable: true,
            isQuickSnack: true,
            shop: { isActive: true },
        },
        select: {
            itemName: true,
            imageUrl: true,
            shopId: true,
            shop: {
                select: {
                    latitude: true,
                    longitude: true,
                },
            },
        },
    });

    // Filter by distance if lat/lng provided
    let filteredMenus = menus;
    if (userLat && userLng && radiusKm) {
        filteredMenus = menus.filter((m) => {
            if (m.shop.latitude && m.shop.longitude) {
                const dist = calculateDistance(
                    userLat,
                    userLng,
                    m.shop.latitude,
                    m.shop.longitude
                );
                return dist <= radiusKm;
            }
            return false;
        });
    }

    // Group by itemName (case-insensitive)
    const map = new Map();
    for (const m of filteredMenus) {
        const key = m.itemName.trim().toLowerCase();
        if (!key) continue;

        if (!map.has(key)) {
            map.set(key, {
                itemName: m.itemName,
                exampleImageUrl: m.imageUrl || null,
                shopsCount: 0,
                shopIds: new Set(),
            });
        }
        map.get(key).shopIds.add(m.shopId);
    }

    // Convert to array with shop counts
    const items = Array.from(map.values()).map((item) => ({
        itemName: item.itemName,
        exampleImageUrl: item.exampleImageUrl,
        shopsCount: item.shopIds.size,
    }));

    return items.sort((a, b) => a.itemName.localeCompare(b.itemName));
}

/**
 * QUICK_SNACK_SHOPS: Returns shops that have a specific quick snack item
 * Used when user clicks on a specific quick snack item (e.g., "Pizza")
 */
async function behaviourQuickSnackShops({ itemName, userLat, userLng, radiusKm, config }) {
    if (!itemName) {
        console.warn('QUICK_SNACK_SHOPS behaviour called without itemName');
        return [];
    }

    const menus = await prisma.menu.findMany({
        where: {
            isAvailable: true,
            isQuickSnack: true,
            itemName: { contains: itemName},
            shop: { isActive: true },
        },
        select: {
            shop: { select: simpleShopSelect },
        },
    });

    // Deduplicate shops
    const shopMap = new Map();
    for (const m of menus) {
        const s = m.shop;
        if (!shopMap.has(s.id)) {
            shopMap.set(s.id, s);
        }
    }

    const shops = Array.from(shopMap.values());

    let processed = shops.map((s) => {
        let distanceKm = null;
        if (userLat && userLng && s.latitude && s.longitude) {
            distanceKm = calculateDistance(userLat, userLng, s.latitude, s.longitude);
        }
        return { ...formatShopSimple(s), distanceKm };
    });

    // Filter by radius if location provided
    if (userLat && userLng && radiusKm) {
        processed = processed
            .filter((s) => s.distanceKm !== null && s.distanceKm <= radiusKm)
            .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return processed;
}

/**
 * CUSTOM_QUERY: Searches shops by menu item name or category name
 * Config: { query: string, radiusKm: number }
 * Example: "pizza", "burger", "spicy"
 */
async function behaviourCustomQuery({ query, userLat, userLng, radiusKm, config }) {
    if (!query) {
        console.warn('CUSTOM_QUERY behaviour called without query');
        return [];
    }

    const shops = await prisma.shop.findMany({
        where: {
            isActive: true,
            menus: {
                some: {
                    isAvailable: true,
                    OR: [
                        { itemName: { contains: query} },
                        { categoryName: { contains: query} },
                    ],
                },
            },
        },
        select: baseShopSelect,
    });

    let processed = shops.map((s) => {
        let distanceKm = null;
        if (userLat && userLng && s.latitude && s.longitude) {
            distanceKm = calculateDistance(userLat, userLng, s.latitude, s.longitude);
        }
        return { ...formatShopForCard(s), distanceKm };
    });

    // Filter by radius if location provided
    if (userLat && userLng && radiusKm) {
        processed = processed
            .filter((s) => s.distanceKm !== null && s.distanceKm <= radiusKm)
            .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return processed;
}

/**
 * STATIC: No dynamic data, just UI component
 * Returns empty array
 */
async function behaviourStatic({ config }) {
    // Static components don't fetch shop data
    return [];
}

// ========================================
// LEGACY BEHAVIOUR (kept for backward compatibility)
// ========================================

/**
 * QUICK_SNACK (OLD): Shows shops with quick snack menu items
 * Config: { chips: string[], minRating: number, radiusKm: number }
 * Optional: category param to filter by specific chip
 */
async function behaviourQuickSnack({ userLat, userLng, radiusKm, config, category }) {
    const chips = Array.isArray(config.chips) ? config.chips : [];
    const minRating = typeof config.minRating === 'number' ? config.minRating : 0;
    const targetCategories = category ? [category] : chips;

    const shops = await prisma.shop.findMany({
        where: {
            isActive: true,
            menus: {
                some: {
                    isAvailable: true,
                    isQuickSnack: true,
                    ...(targetCategories.length && {
                        categoryName: { in: targetCategories },
                    }),
                },
            },
        },
        select: baseShopSelect,
    });

    let processed = shops
        .map((s) => {
            let distanceKm = null;
            if (userLat && userLng && s.latitude && s.longitude) {
                distanceKm = calculateDistance(userLat, userLng, s.latitude, s.longitude);
            }

            // Filter menus to quick snacks only
            let filteredMenus = s.menus.filter((m) => m.isQuickSnack);

            // Further filter by category if specified
            if (category) {
                filteredMenus = filteredMenus.filter((m) => m.categoryName === category);
            } else if (targetCategories.length) {
                filteredMenus = filteredMenus.filter((m) =>
                    targetCategories.includes(m.categoryName)
                );
            }

            return {
                ...formatShopForCard({ ...s, menus: filteredMenus }),
                distanceKm,
            };
        })
        .filter((s) => (s.rating ?? 0) >= minRating);

    // Filter by radius if location provided
    if (userLat && userLng && radiusKm) {
        processed = processed
            .filter((s) => s.distanceKm !== null && s.distanceKm <= radiusKm)
            .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return processed;
}

/**
 * QUICK_SNACK Categories: Returns available quick snack categories
 * Config: { chips: string[], minRating: number, radiusKm: number }
 */
async function behaviourQuickSnackCategories({ userLat, userLng, radiusKm, config }) {
    const chips = Array.isArray(config.chips) ? config.chips : [];
    const minRating = typeof config.minRating === 'number' ? config.minRating : 0;

    const shops = await prisma.shop.findMany({
        where: {
            isActive: true,
            menus: {
                some: {
                    isAvailable: true,
                    isQuickSnack: true,
                    ...(chips.length && {
                        categoryName: { in: chips },
                    }),
                },
            },
        },
        select: {
            id: true,
            latitude: true,
            longitude: true,
            avgRating: true,
            menus: {
                where: {
                    isAvailable: true,
                    isQuickSnack: true,
                },
                select: {
                    id: true,
                    categoryName: true,
                },
            },
        },
    });

    // Filter by rating and distance
    const withinRadiusShops = shops.filter((shop) => {
        if ((shop.avgRating ?? 0) < minRating) return false;

        if (userLat && userLng && shop.latitude && shop.longitude) {
            const distanceKm = calculateDistance(userLat, userLng, shop.latitude, shop.longitude);
            return distanceKm <= radiusKm;
        }

        return true;
    });

    // Collect unique categories with item counts
    const categoryMap = new Map();

    for (const shop of withinRadiusShops) {
        for (const menu of shop.menus) {
            if (!menu.categoryName) continue;
            const name = menu.categoryName.trim();
            if (!name) continue;

            // If chips configured, restrict to them
            if (chips.length && !chips.includes(name)) continue;

            if (!categoryMap.has(name)) {
                categoryMap.set(name, { name, itemCount: 0 });
            }
            categoryMap.get(name).itemCount += 1;
        }
    }

    // Convert to sorted array
    const categories = Array.from(categoryMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
    );

    return categories;
}

// ========================================
// BEHAVIOUR REGISTRY
// ========================================

/**
 * This is the ONLY place you need to add code when creating a new behaviour.
 * 
 * To add a new behaviour:
 * 1. Create a function like behaviourYourName({ userLat, userLng, radiusKm, config, ... })
 * 2. Add it to this registry: YOUR_BEHAVIOUR_NAME: behaviourYourName
 * 3. Admin can now use behaviour="YOUR_BEHAVIOUR_NAME" in AppUiConfig
 * 
 * No changes needed in routes or controllers!
 */
const behaviourHandlers = {
    NEAR_ME: behaviourNearMe,
    QUICK_SNACK: behaviourQuickSnack, // Legacy - kept for backward compatibility
    CATEGORY_BASED: behaviourCategoryBased,
    CUSTOM_QUERY: behaviourCustomQuery,
    STATIC: behaviourStatic,
    
    // Future behaviours can be added here:
    // TOP_RATED: behaviourTopRated,
    // TRENDING: behaviourTrending,
    // OFFER_ONLY: behaviourOfferOnly,
    // SPICY_ONLY: behaviourSpicyOnly,
};

/**
 * Registry for category data handlers (dataType=categories)
 */
const categoryBehaviourHandlers = {
    QUICK_SNACK: behaviourQuickSnackCategories,
    
    // Future category handlers:
    // CUSTOM_QUERY: behaviourCustomQueryCategories,
};

// ========================================
// EXPORTS
// ========================================

export {
    // Main registry (used by controller)
    behaviourHandlers,
    categoryBehaviourHandlers,
    
    // Utilities
    formatShopForCard,
    formatShopSimple,
    calculateDistance,
    
    // New exports for your flow
    behaviourNearMe as getNearMeShops,
    behaviourCategoryBased as getCategoryShops,
    behaviourQuickSnackItems as getQuickSnackItems,
    behaviourQuickSnackShops as getQuickSnackShopsForItem,
    
    // Legacy exports (for backward compatibility if needed)
    behaviourQuickSnack as getQuickSnackShops,
    behaviourCustomQuery as getCustomQueryShops,
    behaviourQuickSnackCategories as getQuickSnackCategoriesData,
};