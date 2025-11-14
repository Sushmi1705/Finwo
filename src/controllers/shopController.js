import prisma from '../services/prismaClient.js';
import { getDistanceFromLatLonInKm } from '../utils/geoUtils.js';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
dayjs.extend(relativeTime);

export const getShopsByCategoryAndLocation = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { lat, lng } = req.query;
    const userId = req.user?.id; // Adjust based on your auth middleware

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Fetch shops under category
    const shops = await prisma.shop.findMany({
      where: { categoryId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        address: true,
        city: true,
        latitude: true,
        longitude: true,
        avgRating: true,
        reviewCount: true,
      },
    });

    // Fetch saved shops for user (if logged in)
    let savedShopIds = new Set();
    if (userId) {
      const savedShops = await prisma.savedShop.findMany({
        where: { userId },
        select: { shopId: true },
      });
      savedShopIds = new Set(savedShops.map(s => s.shopId));
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    // Calculate distance, add distanceText and isSaved
    const shopsWithDistance = shops.map(shop => {
      const distance = getDistanceFromLatLonInKm(
        userLat,
        userLng,
        parseFloat(shop.latitude),
        parseFloat(shop.longitude)
      );
      return {
        ...shop,
        distance,
        distanceText: `${distance.toFixed(1)} km`,
        isSaved: savedShopIds.has(shop.id),
      };
    });

    // Filter shops within 3 km radius
    const nearbyShops = shopsWithDistance.filter(shop => shop.distance <= 3);

    res.json(nearbyShops);
  } catch (error) {
    console.error('Error fetching shops:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getShopList = async (req, res) => {
  try {
    const { shopId } = req.params;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        images: true,
        offers: true,
      },
    });

    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    res.json(shop);
  } catch (error) {
    console.error('Error fetching shop details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getShopDetails = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { userLat, userLng } = req.query;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        images: true,          // ShopImage[]
        offers: {
          where: { isActive: true },
          orderBy: { validFrom: 'desc' },
        },
      },
    });

    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    // Calculate distance if user location provided
    let distance = null;
    let distanceText = null;
    if (userLat && userLng && shop.latitude && shop.longitude) {
      distance = getDistanceFromLatLonInKm(
        parseFloat(userLat),
        parseFloat(userLng),
        shop.latitude,
        shop.longitude
      );
      distanceText = `${distance.toFixed(2)} km`;
    }

    // Calculate average rating and review count if not stored
    const avgRating = shop.avgRating ?? 0;
    const reviewCount = shop.reviewCount ?? 0;

    // Construct links JSON
    const links = {
      direction: shop.latitude && shop.longitude
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shop.latitude)},${encodeURIComponent(shop.longitude)}`
        : null,
      chat: shop.chatLink || null,
      call: shop.phoneNumber ? `tel:${shop.phoneNumber}` : null,
      website: shop.websiteUrl || null,
    };

    res.json({
      id: shop.id,
      name: shop.name,
      logoUrl: shop.logoUrl,
      address: shop.address,
      city: shop.city,
      latitude: shop.latitude,
      longitude: shop.longitude,
      phoneNumber: shop.phoneNumber,
      websiteUrl: shop.websiteUrl,
      chatLink: shop.chatLink,
      openHours: shop.openHours,
      description: shop.description,
      avgRating,
      reviewCount,
      distance,
      distanceText,
      links,
      images: shop.images.map(img => ({
        id: img.id,
        imageUrl: img.imageUrl,
      })),
      offers: shop.offers.map(offer => ({
        id: offer.id,
        title: offer.title,
        description: offer.description,
        validFrom: offer.validFrom,
        validTo: offer.validTo,
        terms: offer.terms,
      })),
    });
  } catch (error) {
    console.error('Error fetching shop details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getShopReviews = async (req, res) => {
  try {
    const { shopId } = req.params;

    // Fetch shop reviewDescription and reviews with related data
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        reviewDescription: true,
        reviews: {
          where: { shopId },
          include: {
            user: {
              select: { name: true, profileImageUrl: true },
            },
            tags: {
              include: {
                tag: true,
              },
            },
            replies: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!shop || !shop.reviews.length) {
      return res.json({
        reviewDescription: shop?.reviewDescription || null,
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: {},
        commonTags: [],
        reviews: [],
      });
    }

    const reviews = shop.reviews;
    const totalReviews = reviews.length;

    // Calculate average rating
    const averageRating = (
      reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    ).toFixed(1);

    // Calculate rating distribution (percentage)
    const ratingCounts = [0, 0, 0, 0, 0];
    reviews.forEach(r => {
      ratingCounts[r.rating - 1]++;
    });
    const ratingDistribution = {};
    for (let i = 5; i >= 1; i--) {
      ratingDistribution[i] = ((ratingCounts[i - 1] / totalReviews) * 100).toFixed(0);
    }

    // Aggregate common tags with counts
    const tagCountMap = {};
    reviews.forEach(r => {
      r.tags.forEach(t => {
        const tagName = t.tag.tagName;
        tagCountMap[tagName] = (tagCountMap[tagName] || 0) + 1;
      });
    });
    const commonTags = Object.entries(tagCountMap)
      .sort((a, b) => b[1] - a[1])
      .map(([tagName]) => tagName);

    // Format reviews for response
    const formattedReviews = reviews.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      timeAgo: dayjs(r.createdAt).fromNow(),
      user: r.user,
      tags: r.tags.map(t => t.tag.tagName),
      replies: r.replies.map(reply => ({
        id: reply.id,
        message: reply.message,
        createdAt: reply.createdAt,
      })),
    }));

    res.json({
      reviewDescription: shop.reviewDescription || null,
      averageRating: parseFloat(averageRating),
      totalReviews,
      ratingDistribution,
      commonTags,
      reviews: formattedReviews,
    });
  } catch (error) {
    console.error('Error fetching shop reviews:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getShopAmenities = async (req, res) => {
  try {
    const { shopId } = req.params;

    const amenities = await prisma.shopAmenity.findMany({
      where: {
        shopId,
        isAvailable: true,
      },
      select: {
        id: true,
        name: true,
        icon: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json({ amenities });
  } catch (error) {
    console.error('Error fetching shop amenities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getShopMenu = async (req, res) => {
  try {
    const { shopId } = req.params;

    const menuItems = await prisma.menu.findMany({
      where: {
        shopId,
        isAvailable: true,
      },
      select: {
        id: true,
        itemName: true,
        description: true,
        price: true,
        imageUrl: true,
        quantity: true
      },
      orderBy: {
        itemName: 'asc',
      },
    });

    // Optional: If you want to extract quantity from itemName (e.g., "Idly (2)"), you can parse it here
    // But usually quantity is stored separately; if not, frontend can parse it.

    res.json({ menu: menuItems });
  } catch (error) {
    console.error('Error fetching shop menu:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};