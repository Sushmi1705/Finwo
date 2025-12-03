// src/controllers/bannerController.js (core logic snippet)
import prisma from '../services/prismaClient.js';

export async function getBanners(req, res) {
  const {
    screen,
    componentType,
    location,
    mainCategoryId,
    limit = 6,
    includeInactive = 'false',
    includeShopDetails = 'false',
    debug = 'false'
  } = req.query;

  const take = Math.min(Math.max(parseInt(limit, 10) || 6, 1), 50);
  const activeOnly = String(includeInactive).toLowerCase() !== 'true';

  const appWhere = {};
  if (screen) appWhere.screenName = screen;
  if (componentType) appWhere.componentType = componentType;
  if (location) appWhere.location = location;
  if (mainCategoryId) appWhere.mainCategoryId = mainCategoryId;
  if (activeOnly) appWhere.isActive = true;

  const appConfigs = await prisma.appUiConfig.findMany({
    where: appWhere,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take
  });

  // Map and filter entries with at least one image
  const appBanners = appConfigs
    .map(cfg => {
      const imageUrl = cfg.imageUrl || cfg.iconUrl || null;
      if (!imageUrl) return null;
      return {
        id: cfg.id,
        source: 'app_ui_config',
        imageUrl,
        title: cfg.componentName || null,
        linkUrl: cfg.config?.linkUrl || null,
        config: cfg.config || null,
        sortOrder: cfg.sortOrder,
        isActive: cfg.isActive,
        createdAt: cfg.createdAt,
        raw: debug === 'true' ? cfg : undefined
      };
    })
    .filter(Boolean);

  // If you also use CategoryBanner, fetch those when mainCategoryId provided:
  let categoryBanners = [];
  if (mainCategoryId) {
    const catWhere = { mainCategoryId };
    if (activeOnly) catWhere.isActive = true;
    const rows = await prisma.categoryBanner.findMany({
      where: catWhere,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take
    });
    categoryBanners = rows.map(b => ({
      id: b.id,
      source: 'category_banner',
      imageUrl: b.imageUrl,
      title: b.title,
      linkUrl: b.linkUrl,
      config: null,
      sortOrder: b.sortOrder,
      isActive: b.isActive,
      createdAt: b.createdAt,
      raw: debug === 'true' ? b : undefined
    }));
  }

  // Merge: categoryBanners first, then appBanners
  const merged = [...categoryBanners, ...appBanners].slice(0, take);

  // Optionally resolve shop when includeShopDetails=true and config.shopId exists
  if (includeShopDetails === 'true') {
    const shopIds = merged
      .map(b => b.config?.shopId)
      .filter(Boolean);
    const uniqueShopIds = [...new Set(shopIds)];
    if (uniqueShopIds.length) {
      const shops = await prisma.shop.findMany({
        where: { id: { in: uniqueShopIds } },
        select: { id: true, name: true, logoUrl: true }
      });
      merged.forEach(b => {
        if (b.config?.shopId) {
          b.resolvedShop = shops.find(s => s.id === b.config.shopId) || null;
        }
      });
    }
  }

  // Fallback if empty
  const final = merged.length ? merged : [{
    id: 'fallback-1',
    source: 'fallback',
    imageUrl: 'https://placehold.co/1200x400?text=Banner+1',
    title: 'Featured',
    linkUrl: null,
    config: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date()
  }];

  return res.json({
    status: 'ok',
    count: final.length,
    banners: final,
    debug: debug === 'true' ? { query: appWhere, mergedCount: merged.length } : undefined
  });
}