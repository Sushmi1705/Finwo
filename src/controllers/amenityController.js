import prisma from '../services/prismaClient.js';

export const getShopAmenities = async (req, res) => {
  try {
    const { shopId } = req.params;

    const amenities = await prisma.shopAmenity.findMany({
      where: { shopId, isAvailable: true },
    });

    res.json(amenities);
  } catch (error) {
    console.error('Error fetching amenities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};