import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create a new shop with 2 reviews
  const newShop = await prisma.shop.create({
    data: {
      categoryId: 'your-category-id-here', // Replace with actual category ID
      name: 'New Test Shop',
      logoUrl: 'https://example.com/images/new-shop-logo.png',
      address: '789 New Street',
      city: 'New City',
      latitude: 12.9800,
      longitude: 77.6000,
      phoneNumber: '5556667777',
      websiteUrl: 'https://newshop.example.com',
      chatLink: 'https://chat.example.com/newshop',
      openHours: '9:00 AM - 10:00 PM',
      avgRating: 4.5,  // Optional, can be updated later
      reviewCount: 2,  // Optional, can be updated later

      // Create 2 reviews linked to this shop
      reviews: {
        create: [
          {
            userId: 'user-id-1',  // Replace with actual user ID
            rating: 5,
            comment: 'Excellent food and service!',
          },
          {
            userId: 'user-id-2',  // Replace with actual user ID
            rating: 4,
            comment: 'Good ambiance but a bit noisy.',
          },
        ],
      },
    },
    include: {
      reviews: true,
    },
  });

  console.log('New shop with reviews created:', newShop);
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });