import prisma from '../services/prismaClient.js';

export const getShopMenu = async (req, res) => {
  try {
    const { shopId } = req.params;

    const menuItems = await prisma.menu.findMany({
      where: { shopId, isAvailable: true },
    });

    res.json(menuItems);
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};