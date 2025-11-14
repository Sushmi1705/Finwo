import prisma from '../services/prismaClient.js';

export const getShopReviews = async (req, res) => {
  try {
    const { shopId } = req.params;

    // Overall rating and count
    const aggregate = await prisma.review.aggregate({
      where: { shopId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    // Rating distribution
    const ratingCounts = await Promise.all(
      [5, 4, 3, 2, 1].map(async (star) => {
        const count = await prisma.review.count({
          where: { shopId, rating: star },
        });
        return { star, count };
      })
    );

    // Tags with counts
    const tags = await prisma.reviewTag.findMany({
      include: {
        reviewLinks: {
          where: { review: { shopId } },
          select: { id: true },
        },
      },
    });

    // Reviews with user info and replies
    const reviews = await prisma.review.findMany({
      where: { shopId },
      include: {
        user: { select: { name: true } },
        tags: { include: { tag: true } },
        replies: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      aggregate,
      ratingCounts,
      tags,
      reviews,
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};