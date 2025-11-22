import prisma from '../services/prismaClient.js';

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
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
        },
    },
};

async function getNearMeShops({ userLat, userLng, radiusKm }) {
    const shops = await prisma.shop.findMany({
        where: { isActive: true },
        select: baseShopSelect,
    });

    let processed = shops.map(s => {
        let distanceKm = null;
        if (userLat && userLng && s.latitude && s.longitude) {
            distanceKm = calculateDistance(userLat, userLng, s.latitude, s.longitude);
        }
        return { ...formatShopForCard(s), distanceKm };
    });

    if (userLat && userLng) {
        processed = processed
            .filter(s => s.distanceKm !== null && s.distanceKm <= radiusKm)
            .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return processed;
}

// ========== 2. GET QUICK SNACK SHOPS ==========
async function getQuickSnackShops({ userLat, userLng, radiusKm, config, category }) {
    const chips = Array.isArray(config.chips) ? config.chips : [];
    const minRating = typeof config.minRating === 'number' ? config.minRating : 0;

    // If category param is passed, focus on just that one
    const targetCategories = category ? [category] : chips;

    const shops = await prisma.shop.findMany({
        where: {
            isActive: true,
            menus: targetCategories.length
                ? {
                    some: {
                        isAvailable: true,
                        categoryName: { in: targetCategories },
                    },
                }
                : {
                    some: {
                        isAvailable: true,
                    },
                },
        },
        select: baseShopSelect,
    });

    let processed = shops
        .map(s => {
            let distanceKm = null;
            if (userLat && userLng && s.latitude && s.longitude) {
                distanceKm = calculateDistance(userLat, userLng, s.latitude, s.longitude);
            }

            // Filter menu items to only show matching category items
            let filteredMenus = s.menus;
            if (category) {
                filteredMenus = s.menus.filter(m => m.categoryName === category);
            } else if (targetCategories.length) {
                filteredMenus = s.menus.filter(m => targetCategories.includes(m.categoryName));
            }

            return {
                ...formatShopForCard({ ...s, menus: filteredMenus }),
                distanceKm
            };
        })
        .filter(s => s.rating >= minRating);

    if (userLat && userLng) {
        processed = processed
            .filter(s => s.distanceKm !== null && s.distanceKm <= radiusKm)
            .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return processed;
}

// ========== 3. GET QUICK SNACK CATEGORIES (Browse by category) ==========
async function getQuickSnackCategories({ userLat, userLng, radiusKm, config }) {
    const chips = Array.isArray(config.chips) ? config.chips : [];
    const minRating = typeof config.minRating === 'number' ? config.minRating : 0;

    // 1) Find candidate shops
    const shops = await prisma.shop.findMany({
        where: {
            isActive: true,
            menus: chips.length
                ? {
                    some: {
                        isAvailable: true,
                        categoryName: { in: chips },
                    },
                }
                : {
                    some: {
                        isAvailable: true,
                    },
                },
        },
        select: {
            id: true,
            latitude: true,
            longitude: true,
            avgRating: true,
            menus: {
                where: { isAvailable: true },
                select: {
                    id: true,
                    categoryName: true,
                },
            },
        },
    });

    // 2) Filter by rating + distance
    const withinRadiusShops = shops.filter(shop => {
        if ((shop.avgRating ?? 0) < minRating) return false;

        if (userLat && userLng && shop.latitude && shop.longitude) {
            const distanceKm = calculateDistance(userLat, userLng, shop.latitude, shop.longitude);
            return distanceKm <= radiusKm;
        }

        return true;
    });

    // 3) Collect unique category names + count items
    const categoryMap = new Map(); // categoryName -> { name, itemCount }

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

    // 4) Convert to sorted array
    const categories = Array.from(categoryMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
    );

    return categories;
}

async function getCategoryShops({ mainCategoryId }) {
    if (!mainCategoryId) return [];
    const shops = await prisma.shop.findMany({
        where: { isActive: true, categoryId: mainCategoryId },
        select: baseShopSelect,
    });
    return shops.map(s => formatShopForCard(s));
}

async function getFallbackSuggestionShops({ userLat, userLng, radiusKm }) {
    // simple: reuse NearMe but allow no location
    return getNearMeShops({ userLat, userLng, radiusKm });
}

function formatShopForCard(shop) {
    const prices = shop.menus.map(m => m.price).filter(p => p != null);
    const minPrice = prices.length ? Math.min(...prices) : null;
    const maxPrice = prices.length ? Math.max(...prices) : null;

    const menuCategories = [
        ...new Set(shop.menus.map(m => m.categoryName).filter(Boolean)),
    ];

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

// ✅ EXPORT ALL FUNCTIONS
export {
    getNearMeShops,
    getQuickSnackShops,
    getCategoryShops,
    getFallbackSuggestionShops,
    formatShopForCard,
    getQuickSnackCategories,   // ← NEW
};