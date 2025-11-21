import prisma from '../services/prismaClient.js';
import {
    formatShopForCard,
} from '../services/suggestionsService.js';  // ← ADD THIS
// Approximate 1 degree latitude ~ 111 km
const KM_IN_DEGREE = 1 / 111; // ~0.009 degrees per km

export const getAllMainCategories = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      // No lat/lng provided, return all active categories
      const categories = await prisma.mainCategory.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      });
      return res.json(categories);
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusKm = 5; // radius in km

    // Calculate bounding box
    const latDiff = radiusKm * KM_IN_DEGREE;
    const lngDiff = radiusKm * KM_IN_DEGREE / Math.cos(latitude * (Math.PI / 180));

    const minLat = latitude - latDiff;
    const maxLat = latitude + latDiff;
    const minLng = longitude - lngDiff;
    const maxLng = longitude + lngDiff;

    // Find categories that have shops within bounding box
    const categories = await prisma.mainCategory.findMany({
      where: {
        isActive: true,
        shops: {
          some: {
            latitude: { gte: minLat, lte: maxLat },
            longitude: { gte: minLng, lte: maxLng },
          },
        },
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
      },
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCategoryBanner = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const banners = await prisma.categoryBanner.findMany({
      where: { mainCategoryId: categoryId, isActive: true },
      select: { id: true, imageUrl: true, title: true, linkUrl: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ banners });
  } catch (error) {
    console.error('Error fetching category banners:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCategoryShopsList = async (req, res) => {
  try {
    const { mainCategoryId } = req.params;

    const shops = await prisma.shop.findMany({
      where: { isActive: true, categoryId: mainCategoryId },
      select: {
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
          select: { price: true },
        },
      },
    });

    res.json({
      mainCategoryId,
      totalResults: shops.length,
      shops: shops.map(formatShopForCard),
    });
  } catch (err) {
    console.error('Error fetching category shops:', err);
    res.status(500).json({ error: 'Failed to fetch category shops' });
  }
};