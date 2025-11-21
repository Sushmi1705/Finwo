// controllers/suggestionsController.js
import prisma from '../services/prismaClient.js';
import {
    getNearMeShops,
    getQuickSnackShops,
    getCategoryShops,
    getFallbackSuggestionShops,
    getQuickSnackCategories,   // ← NEW
} from '../services/suggestionsService.js';  // ← ADD THIS

export const getSuggestions = async (req, res) => {
    try {
        const sections = await prisma.suggestionSection.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
                items: {
                    where: { isActive: true },
                    orderBy: { sortOrder: 'asc' },
                    select: {
                        id: true,
                        title: true,
                        subtitle: true,
                        imageUrl: true,
                        shopId: true,
                        mainCategoryId: true,
                    },
                },
                mainCategory: {
                    select: { id: true, name: true, imageUrl: true },
                },
            },
        });

        res.json({
            sections: sections.map(s => ({
                id: s.id,
                title: s.title,
                subtitle: s.subtitle,
                imageUrl: s.imageUrl,
                type: s.type,
                mainCategory: s.mainCategory,
                config: s.config,
                items: s.items,
            })),
        });
    } catch (err) {
        console.error('Error fetching suggestions:', err);
        res.status(500).json({ error: 'Failed to fetch suggestions' });
    }
};

export const getSuggestionShops = async (req, res) => {
    try {
        const { sectionId } = req.params;
        const { lat, lng, radius, userId, category } = req.query;

        const section = await prisma.suggestionSection.findUnique({
            where: { id: sectionId },
        });

        if (!section || !section.isActive) {
            return res.status(404).json({ error: 'Suggestion section not found' });
        }

        const config = section.config || {};
        const userLat = lat ? parseFloat(lat) : null;
        const userLng = lng ? parseFloat(lng) : null;
        const baseRadius = radius ? parseFloat(radius) : (config.maxDistanceKm || 7);

        let shops = [];

        switch (section.type) {
            case 'NEAR_ME':
                shops = await getNearMeShops({ userLat, userLng, radiusKm: baseRadius });
                break;

            case 'QUICK_SNACK':
                shops = await getQuickSnackShops({
                    userLat,
                    userLng,
                    radiusKm: baseRadius,
                    config,
                    category: category || null,   // ← pass category
                });
                break;

            case 'CATEGORY_SHOPS':
                shops = await getCategoryShops({ mainCategoryId: section.mainCategoryId });
                break;

            case 'CUSTOM':
            default:
                shops = await getFallbackSuggestionShops({ userLat, userLng, radiusKm: baseRadius });
                break;
        }

        if (userId) {
            const saved = await prisma.savedShop.findMany({
                where: { userId },
                select: { shopId: true },
            });
            const savedIds = new Set(saved.map(s => s.shopId));
            shops = shops.map(s => ({ ...s, isSaved: savedIds.has(s.id) }));
        }

        res.json({
            section: {
                id: section.id,
                title: section.title,
                type: section.type,
            },
            totalResults: shops.length,
            shops,
        });
    } catch (err) {
        console.error('Error fetching suggestion shops:', err);
        res.status(500).json({ error: 'Failed to fetch suggestion shops' });
    }
};

export const getQuickSnackMenuCategories = async (req, res) => {
    try {
        const { sectionId } = req.params;
        const { lat, lng, radius } = req.query;

        const section = await prisma.suggestionSection.findUnique({
            where: { id: sectionId },
        });

        if (!section || !section.isActive || section.type !== 'QUICK_SNACK') {
            return res.status(404).json({ error: 'Quick Snack section not found' });
        }

        const config = section.config || {};
        const userLat = lat ? parseFloat(lat) : null;
        const userLng = lng ? parseFloat(lng) : null;
        const baseRadius = radius ? parseFloat(radius) : (config.maxDistanceKm || 5);

        const categories = await getQuickSnackCategories({
            userLat,
            userLng,
            radiusKm: baseRadius,
            config,
        });

        return res.json({
            sectionId: section.id,
            title: section.title,
            categories,
        });
    } catch (err) {
        console.error('Error fetching quick snack categories:', err);
        res.status(500).json({ error: 'Failed to fetch quick snack categories' });
    }
};