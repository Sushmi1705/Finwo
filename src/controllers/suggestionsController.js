import prisma from '../services/prismaClient.js';
import {
    getNearMeShops,
    getCategoryShops,
    getQuickSnackItems,
    getQuickSnackShopsForItem,
} from '../services/suggestionsService.js';

// 1) dynamic suggestions list
export const getSuggestionsScreen = async (req, res) => {
    try {
        const components = await prisma.appUiConfig.findMany({
            where: { screenName: 'SUGGESTIONS', isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
                mainCategory: { select: { id: true, name: true, imageUrl: true } },
            },
        });

        const chips = components
            .filter((c) => c.componentType === 'CHIP')
            .map((c) => {
                let config = {};
                if (c.config) {
                    try {
                        config = JSON.parse(c.config);
                    } catch {
                        config = {};
                    }
                }
                return {
                    id: c.id,
                    type: c.componentType,
                    name: c.componentName,
                    behaviour: c.behaviour,
                    iconUrl: c.iconUrl,
                    mainCategory: c.mainCategory,
                    config,
                    sortOrder: c.sortOrder,
                };
            });

        res.json({
            screenName: 'SUGGESTIONS',
            displayName: 'Suggestions',
            chips,
        });
    } catch (err) {
        console.error('Error fetching suggestions screen:', err);
        res.status(500).json({ error: 'Failed to fetch suggestions screen' });
    }
};

// 2) shops for NEAR_ME or CATEGORY_BASED suggestion
export const getSuggestionShops = async (req, res) => {
    try {
        const { componentId } = req.params;
        const { lat, lng, radiusKm } = req.query;

        const component = await prisma.appUiConfig.findUnique({
            where: { id: componentId },
            include: {
                mainCategory: { select: { id: true, name: true } },
            },
        });

        if (!component || !component.isActive) {
            return res.status(404).json({ error: 'Component not found or inactive' });
        }

        const userLat = lat ? parseFloat(lat) : null;
        const userLng = lng ? parseFloat(lng) : null;
        let config = {};
        if (component.config) {
            try {
                config = JSON.parse(component.config);
            } catch {
                config = {};
            }
        }

        let shops = [];
        if (component.behaviour === 'NEAR_ME') {
            const r = radiusKm
                ? parseFloat(radiusKm)
                : config.radiusKm
                    ? parseFloat(config.radiusKm)
                    : 7;
            shops = await getNearMeShops({ userLat, userLng, radiusKm: r });
        } else if (component.behaviour === 'CATEGORY_BASED') {
            shops = await getCategoryShops({
                mainCategoryId: component.mainCategoryId,
                userLat,
                userLng,
            });
        } else {
            return res.status(400).json({
                error: 'This component behaviour is not supported by /shops endpoint',
                behaviour: component.behaviour,
            });
        }

        res.json({
            component: {
                id: component.id,
                name: component.componentName,
                behaviour: component.behaviour,
                mainCategory: component.mainCategory,
            },
            dataType: 'shops',
            totalResults: shops.length,
            shops,
        });
    } catch (err) {
        console.error('Error fetching suggestion shops:', err);
        res.status(500).json({ error: 'Failed to fetch suggestion shops' });
    }
};

// 3A) list quick snack items
export const getQuickSnackItemsController = async (req, res) => {
    try {
        const { componentId } = req.params;

        const component = await prisma.appUiConfig.findUnique({
            where: { id: componentId },
        });

        if (!component || !component.isActive) {
            return res.status(404).json({ error: 'Component not found or inactive' });
        }

        if (component.behaviour !== 'QUICK_SNACK') {
            return res.status(400).json({
                error: 'This component is not a QUICK_SNACK behaviour',
                behaviour: component.behaviour,
            });
        }

        // parse component config (if present)
        let config = {};
        if (component.config) {
            try {
                config = JSON.parse(component.config);
            } catch (e) {
                config = {};
            }
        }

        const { lat, lng, radiusKm, city } = req.query;
        const userLat = lat ? parseFloat(lat) : null;
        const userLng = lng ? parseFloat(lng) : null;
        const r = radiusKm
            ? parseFloat(radiusKm)
            : config.radiusKm
                ? parseFloat(config.radiusKm)
                : null;

        // 1) Fetch quick snack items (existing service)
        const items = await getQuickSnackItems({
            userLat,
            userLng,
            radiusKm: r,
            config,
        });

        // 2) Fetch banners for the SUGGESTIONS screen
        //    (Admin can add rows with componentType = 'BANNER')
        const bannerConfigs = await prisma.appUiConfig.findMany({
            where: {
                screenName: 'SUGGESTIONS',
                componentType: 'BANNER',
                isActive: true,
                // location filtering at DB-level if city is provided and you store location in the field
                ...(city ? { location: city } : {}),
            },
            orderBy: { sortOrder: 'asc' },
            select: {
                id: true,
                componentName: true,
                imageUrl: true,
                iconUrl: true,
                config: true,
                location: true,
                sortOrder: true,
            },
        });

        // 3) Parse and filter banners JS-side for targeting rules (config.targetComponentId or config.tags)
        const normalizedBanners = bannerConfigs
            .map((b) => {
                let bcfg = {};
                if (b.config) {
                    try {
                        bcfg = JSON.parse(b.config);
                    } catch (e) {
                        bcfg = {};
                    }
                }
                return {
                    id: b.id,
                    name: b.componentName,
                    imageUrl: b.imageUrl || bcfg.imageUrl || null,
                    iconUrl: b.iconUrl || bcfg.iconUrl || null,
                    title: bcfg.title || null,
                    subtitle: bcfg.subtitle || null,
                    ctaLabel: bcfg.ctaLabel || null,
                    ctaUrl: bcfg.ctaUrl || null,
                    tags: Array.isArray(bcfg.tags) ? bcfg.tags : [],
                    targetComponentId: bcfg.targetComponentId || null,
                    location: b.location || bcfg.location || null,
                    sortOrder: b.sortOrder ?? 0,
                };
            })
            // keep banners that are global OR explicitly targeted to this component OR match a tag
            .filter((b) => {
                // if banner targets specific component, only allow if matches
                if (b.targetComponentId) {
                    return b.targetComponentId === componentId;
                }
                // if tags exist, allow if it includes 'quick_snack' or component name
                if (b.tags && b.tags.length > 0) {
                    if (b.tags.includes('quick_snack')) return true;
                    if (b.tags.includes(component.componentName)) return true;
                }
                // otherwise allow (global banner)
                return true;
            })
            .sort((a, b) => a.sortOrder - b.sortOrder);

        // 4) If the component itself has a `config.banner`, put it first (optional)
        //    Example component.config.banner: { "imageUrl": "...", "title": "...", "ctaUrl": "..." }
        if (config.banner && typeof config.banner === 'object') {
            const compBanner = {
                id: `${componentId}-inline-banner`,
                name: `${component.componentName} Banner`,
                imageUrl: config.banner.imageUrl || null,
                title: config.banner.title || null,
                subtitle: config.banner.subtitle || null,
                ctaLabel: config.banner.ctaLabel || null,
                ctaUrl: config.banner.ctaUrl || null,
                sortOrder: -1,
            };
            // ensure we don't duplicate if same image exists in normalizedBanners
            const exists = normalizedBanners.some((b) => b.imageUrl === compBanner.imageUrl);
            if (!exists) normalizedBanners.unshift(compBanner);
        }

        res.json({
            component: {
                id: component.id,
                name: component.componentName,
                behaviour: component.behaviour,
            },
            dataType: 'quickSnacks',
            banners: normalizedBanners,
            items,
        });
    } catch (err) {
        console.error('Error fetching quick snack items:', err);
        res.status(500).json({ error: 'Failed to fetch quick snack items' });
    }
};

// 3B) shops for a quick snack item (e.g. pizza)
export const getQuickSnackItemShopsController = async (req, res) => {
    try {
        const { componentId } = req.params;
        const { itemName, lat, lng, radiusKm } = req.query;

        const component = await prisma.appUiConfig.findUnique({
            where: { id: componentId },
        });

        if (!component || !component.isActive) {
            return res.status(404).json({ error: 'Component not found or inactive' });
        }

        if (component.behaviour !== 'QUICK_SNACK') {
            return res.status(400).json({
                error: 'This component is not a QUICK_SNACK behaviour',
                behaviour: component.behaviour,
            });
        }

        if (!itemName) {
            return res.status(400).json({ error: 'itemName query param is required' });
        }

        let config = {};
        if (component.config) {
            try {
                config = JSON.parse(component.config);
            } catch {
                config = {};
            }
        }

        const userLat = lat ? parseFloat(lat) : null;
        const userLng = lng ? parseFloat(lng) : null;
        const r = radiusKm
            ? parseFloat(radiusKm)
            : config.radiusKm
                ? parseFloat(config.radiusKm)
                : null;

        const shops = await getQuickSnackShopsForItem({
            itemName,
            userLat,
            userLng,
            radiusKm: r,
            config,
        });

        res.json({
            component: {
                id: component.id,
                name: component.componentName,
                behaviour: component.behaviour,
            },
            itemName,
            dataType: 'shops',
            totalResults: shops.length,
            shops,
        });
    } catch (err) {
        console.error('Error fetching quick snack item shops:', err);
        res.status(500).json({ error: 'Failed to fetch quick snack item shops' });
    }
};