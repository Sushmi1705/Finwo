// seed.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1) Ensure main categories exist
  const categories = {
    food: await findOrCreateMainCategory('Food & Beverages'),
    fashion: await findOrCreateMainCategory('Fashion'),
    electronics: await findOrCreateMainCategory('Electronics & Appliances'),
    grocery: await findOrCreateMainCategory('Grocery & General Stores'),
  };

  // 2) Shop definitions (adjust image URLs & details as required)
  const shopsToSeed = [
    {
      name: 'Kuala Food Hub',
      category: categories.food,
      description: 'Popular spot for snacks and quick bites',
      address: 'Food Street, Kuala Lumpur',
      city: 'Kuala Lumpur',
      latitude: 3.1362565,
      longitude: 101.6941514,
      phoneNumber: '+60123456789',
      openHours: '09:00 AM - 10:00 PM',
      logoUrl: 'https://res.cloudinary.com/<your_cloud>/image/upload/v12345/finwo/shops/kuala_food_hub.jpg',
      avgRating: 4.5,
      reviewCount: 10,
    },
    {
      name: 'Chennai Spice Corner',
      category: categories.food,
      description: 'Authentic South Indian cuisine',
      address: '456 Anna Salai',
      city: 'Chennai',
      latitude: 13.0827,
      longitude: 80.2707,
      phoneNumber: '+919876543210',
      openHours: '10:00 AM - 11:00 PM',
      logoUrl: 'https://res.cloudinary.com/<your_cloud>/image/upload/v12345/finwo/shops/chennai_spice_corner.jpg',
      avgRating: 4.2,
      reviewCount: 8,
    },
    {
      name: 'KL Electronics World',
      category: categories.electronics,
      description: 'Latest gadgets and appliances',
      address: 'Tech Park, Kuala Lumpur',
      city: 'Kuala Lumpur',
      latitude: 3.1500,
      longitude: 101.7100,
      phoneNumber: '+60111222333',
      openHours: '10:00 AM - 8:00 PM',
      logoUrl: 'https://res.cloudinary.com/<your_cloud>/image/upload/v12345/finwo/shops/kl_elec_world.jpg',
      avgRating: 4.0,
      reviewCount: 5,
    },
    {
      name: 'Fashion Boutique KL',
      category: categories.fashion,
      description: 'Trendy fashion store',
      address: '789 Pavilion Mall',
      city: 'Kuala Lumpur',
      latitude: 3.1490,
      longitude: 101.7131,
      phoneNumber: '+60198765432',
      openHours: '10:00 AM - 9:00 PM',
      logoUrl: 'https://res.cloudinary.com/<your_cloud>/image/upload/v12345/finwo/shops/fashion_boutique_kl.jpg',
      avgRating: 4.1,
      reviewCount: 7,
    },
    {
      name: 'KL Grocery Mart',
      category: categories.grocery,
      description: 'Daily essentials and groceries',
      address: 'Market Road, Kuala Lumpur',
      city: 'Kuala Lumpur',
      latitude: 3.1450,
      longitude: 101.7050,
      phoneNumber: '+60199887766',
      openHours: '08:00 AM - 10:00 PM',
      logoUrl: 'https://res.cloudinary.com/<your_cloud>/image/upload/v12345/finwo/shops/kl_grocery_mart.jpg',
      avgRating: 4.3,
      reviewCount: 20,
    },
  ];

  for (const s of shopsToSeed) {
    // find or create shop (matching by name)
    let shop = await prisma.shop.findFirst({ where: { name: s.name } });
    if (!shop) {
      shop = await prisma.shop.create({
        data: {
          categoryId: s.category.id,
          name: s.name,
          logoUrl: s.logoUrl,
          description: s.description,
          address: s.address,
          city: s.city,
          latitude: s.latitude,
          longitude: s.longitude,
          phoneNumber: s.phoneNumber,
          openHours: s.openHours,
          avgRating: s.avgRating,
          reviewCount: s.reviewCount,
          isActive: true,
        },
      });
      console.log(`+ Created shop: ${s.name}`);
    } else {
      // update some fields if you want to keep them in sync
      await prisma.shop.update({
        where: { id: shop.id },
        data: {
          logoUrl: s.logoUrl,
          description: s.description,
          address: s.address,
          city: s.city,
          latitude: s.latitude,
          longitude: s.longitude,
          phoneNumber: s.phoneNumber,
          openHours: s.openHours,
          avgRating: s.avgRating,
          reviewCount: s.reviewCount,
          isActive: true,
        },
      });
      console.log(`~ Updated shop: ${s.name}`);
    }

    // Clear existing images/amenities/offers for idempotency
    await prisma.shopImage.deleteMany({ where: { shopId: shop.id } });
    await prisma.shopAmenity.deleteMany({ where: { shopId: shop.id } });
    await prisma.shopOffer.deleteMany({ where: { shopId: shop.id } });

    // Add sample images (mark first as primary)
    const shopImages = [
      {
        shopId: shop.id,
        imageUrl: s.logoUrl,
        isPrimary: true,
      },
      {
        shopId: shop.id,
        imageUrl: s.logoUrl.replace('.jpg', '_2.jpg'), // example alt image (replace if needed)
        isPrimary: false,
      },
    ];
    await prisma.shopImage.createMany({ data: shopImages });

    // Add sample amenities
    const defaultAmenities = [
      { shopId: shop.id, name: 'Free WiFi', icon: 'wifi', isAvailable: true },
      { shopId: shop.id, name: 'Home Delivery', icon: 'delivery', isAvailable: true },
      { shopId: shop.id, name: 'Parking', icon: 'parking', isAvailable: true },
    ];
    // Customize amenities for certain shops (example)
    let amenitiesToInsert = defaultAmenities;
    if (s.name.includes('Electronics')) {
      amenitiesToInsert = [
        { shopId: shop.id, name: 'Warranty Support', icon: 'warranty', isAvailable: true },
        { shopId: shop.id, name: 'Parking', icon: 'parking', isAvailable: true },
      ];
    }
    await prisma.shopAmenity.createMany({ data: amenitiesToInsert });

    // Add sample offers
    const now = new Date();
    const oneWeekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const offers = [
      {
        shopId: shop.id,
        title: `${s.name} - Special Offer`,
        description: 'Get 10% off on selected items',
        validFrom: now,
        validTo: oneWeekLater,
        terms: 'Valid on orders above $10',
        isActive: true,
      },
    ];
    await prisma.shopOffer.createMany({ data: offers });

    console.log(`  ▪ shopImages / shopAmenities / shopOffers created for ${s.name}`);
  }

  console.log('🎉 Seed completed successfully!');
}

// helper: find or create main category
async function findOrCreateMainCategory(name) {
  let c = await prisma.mainCategory.findFirst({ where: { name } });
  if (!c) {
    c = await prisma.mainCategory.create({
      data: {
        name,
        imageUrl: null,
        isActive: true,
      },
    });
    console.log(`+ Created main category: ${name}`);
  }
  return c;
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });