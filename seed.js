// seed.js (CommonJS) - run with: node seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const baseLat = 12.87205347758161;
  const baseLng = 80.20380525242848;

  // Users
  const userAlice = await prisma.user.upsert({
    where: { mobile: '9999999001' },
    update: {},
    create: {
      id: 'user-alice',
      name: 'Alice Tester',
      email: 'alice@example.com',
      mobile: '9999999001',
      profileImageUrl: null,
      phoneAuthEnabled: true
    }
  });

  const userBob = await prisma.user.upsert({
    where: { mobile: '9999999002' },
    update: {},
    create: {
      id: 'user-bob',
      name: 'Bob Merchant',
      email: 'bob@example.com',
      mobile: '9999999002'
    }
  });

  // Addresses
  await prisma.address.upsert({
    where: { id: 'addr-alice-home' },
    update: {},
    create: {
      id: 'addr-alice-home',
      userId: userAlice.id,
      label: 'Home',
      addressLine1: '12 Example Street',
      city: 'Chennai',
      latitude: baseLat,
      longitude: baseLng,
      isDefault: true
    }
  });

  await prisma.address.upsert({
    where: { id: 'addr-bob-office' },
    update: {},
    create: {
      id: 'addr-bob-office',
      userId: userBob.id,
      label: 'Work',
      addressLine1: '88 Merchant Lane',
      city: 'Chennai',
      latitude: baseLat + 0.002,
      longitude: baseLng - 0.002,
      isDefault: true
    }
  });

  // Main categories
  const mainCategories = [
    { id: 'maincat-pizza', name: 'Pizza' },
    { id: 'maincat-burger', name: 'Burgers' },
    { id: 'maincat-dessert', name: 'Desserts' },
    { id: 'maincat-cafe', name: 'Cafes' }
  ];
  for (const c of mainCategories) {
    await prisma.mainCategory.upsert({
      where: { id: c.id },
      update: { name: c.name },
      create: { id: c.id, name: c.name }
    });
  }

  // Shops
  const shops = [
    {
      id: 'shop-savarana',
      categoryId: 'maincat-cafe',
      name: 'Hotel Savarana Bhavan',
      address: 'Near MG Road, Chennai',
      city: 'Chennai',
      latitude: baseLat,
      longitude: baseLng,
      avgRating: 4.4,
      reviewCount: 120
    },
    {
      id: 'shop-mithai',
      categoryId: 'maincat-dessert',
      name: 'Mithai Mandir',
      address: 'Sweet Lane, Chennai',
      city: 'Chennai',
      latitude: baseLat + 0.0012,
      longitude: baseLng - 0.0008,
      avgRating: 4.2,
      reviewCount: 75
    },
    {
      id: 'shop-crispy-dosa',
      categoryId: 'maincat-burger',
      name: 'Crispy Dosa',
      address: 'Dosa Street, Chennai',
      city: 'Chennai',
      latitude: baseLat - 0.0009,
      longitude: baseLng + 0.0015,
      avgRating: 4.0,
      reviewCount: 40
    },
    {
      id: 'shop-vasantha',
      categoryId: 'maincat-cafe',
      name: 'Vasantha Bhavan',
      address: 'Temple Road, Chennai',
      city: 'Chennai',
      latitude: baseLat + 0.003,
      longitude: baseLng - 0.001,
      avgRating: 4.3,
      reviewCount: 210
    },
    {
      id: 'shop-kl-cafe',
      categoryId: 'maincat-cafe',
      name: 'KL Coffee Corner',
      address: 'Bukit Bintang, Kuala Lumpur',
      city: 'Kuala Lumpur',
      latitude: 3.1425,
      longitude: 101.6865,
      avgRating: 4.1,
      reviewCount: 52
    }
  ];

  for (const s of shops) {
    await prisma.shop.upsert({
      where: { id: s.id },
      update: {
        name: s.name,
        latitude: s.latitude,
        longitude: s.longitude,
        avgRating: s.avgRating,
        reviewCount: s.reviewCount
      },
      create: {
        id: s.id,
        categoryId: s.categoryId,
        name: s.name,
        description: `${s.name} - sample description`,
        address: s.address,
        city: s.city,
        latitude: s.latitude,
        longitude: s.longitude,
        avgRating: s.avgRating,
        reviewCount: s.reviewCount,
        isActive: true
      }
    });
  }

  // Shop images
  const shopImages = [
    { id: 'si-1', shopId: 'shop-savarana', imageUrl: 'https://placehold.co/300x200?text=savarana-1', isPrimary: true },
    { id: 'si-2', shopId: 'shop-mithai', imageUrl: 'https://placehold.co/300x200?text=mithai-1', isPrimary: true },
    { id: 'si-3', shopId: 'shop-crispy-dosa', imageUrl: 'https://placehold.co/300x200?text=crispy-1', isPrimary: true },
    { id: 'si-4', shopId: 'shop-vasantha', imageUrl: 'https://placehold.co/300x200?text=vasantha-1', isPrimary: true },
    { id: 'si-5', shopId: 'shop-kl-cafe', imageUrl: 'https://placehold.co/300x200?text=kl-1', isPrimary: true }
  ];
  for (const img of shopImages) {
    await prisma.shopImage.upsert({
      where: { id: img.id },
      update: { imageUrl: img.imageUrl, isPrimary: img.isPrimary },
      create: img
    });
  }

  // Amenities
  const amenities = [
    { id: 'amen-1', shopId: 'shop-savarana', name: 'AC Seating', icon: 'ac', isAvailable: true },
    { id: 'amen-2', shopId: 'shop-savarana', name: 'Home Delivery', icon: 'bike', isAvailable: true },
    { id: 'amen-3', shopId: 'shop-mithai', name: 'Takeaway', icon: 'bag', isAvailable: true },
    { id: 'amen-4', shopId: 'shop-crispy-dosa', name: 'Outdoor Seating', icon: 'outdoor', isAvailable: true },
    { id: 'amen-5', shopId: 'shop-vasantha', name: 'Vegetarian', icon: 'veg', isAvailable: true },
    { id: 'amen-6', shopId: 'shop-kl-cafe', name: 'WiFi', icon: 'wifi', isAvailable: true }
  ];
  for (const a of amenities) {
    await prisma.shopAmenity.upsert({
      where: { id: a.id },
      update: { name: a.name, isAvailable: a.isAvailable },
      create: a
    });
  }

  // Offers
  const offers = [
    {
      id: 'offer-1',
      shopId: 'shop-savarana',
      title: 'Breakfast Discount',
      description: '10% off on breakfast items',
      validFrom: new Date(),
      validTo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      isActive: true
    },
    {
      id: 'offer-2',
      shopId: 'shop-vasantha',
      title: 'Combo Meal',
      description: 'Buy 1 Get 1 on select combos',
      validFrom: new Date(),
      validTo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      isActive: true
    }
  ];
  for (const o of offers) {
    await prisma.shopOffer.upsert({
      where: { id: o.id },
      update: { title: o.title, isActive: o.isActive },
      create: o
    });
  }

  // Menus - IMPORTANT: do NOT include createdAt (Menu model has no createdAt)
  const menus = [
    { id: 'menu-1', shopId: 'shop-savarana', itemName: 'Idli Plate', price: 120.0 },
    { id: 'menu-2', shopId: 'shop-savarana', itemName: 'Thali Special', price: 350.0 },
    { id: 'menu-3', shopId: 'shop-savarana', itemName: 'Family Meal', price: 1200.0 },
    { id: 'menu-4', shopId: 'shop-savarana', itemName: 'Catered Feast', price: 2500.0 },
    { id: 'menu-5', shopId: 'shop-mithai', itemName: 'Gulab Jamun (2 pcs)', price: 80.0 },
    { id: 'menu-6', shopId: 'shop-mithai', itemName: 'Sweet Box', price: 450.0 },
    { id: 'menu-7', shopId: 'shop-crispy-dosa', itemName: 'Masala Dosa', price: 150.0 },
    { id: 'menu-8', shopId: 'shop-crispy-dosa', itemName: 'Combo + Drink', price: 220.0 },
    { id: 'menu-9', shopId: 'shop-vasantha', itemName: 'Weekend Thali', price: 375.0 },
    { id: 'menu-10', shopId: 'shop-kl-cafe', itemName: 'Latte', price: 12.0 }
  ];
  for (const m of menus) {
    await prisma.menu.upsert({
      where: { id: m.id },
      update: { price: m.price, itemName: m.itemName },
      create: {
        id: m.id,
        shopId: m.shopId,
        itemName: m.itemName,
        price: m.price,
        isAvailable: true
      }
    });
  }

  // Category banners
  await prisma.categoryBanner.upsert({
    where: { id: 'cb-1' },
    update: {},
    create: {
      id: 'cb-1',
      mainCategoryId: 'maincat-pizza',
      imageUrl: 'https://placehold.co/1200x400?text=Pizza+Banner',
      title: 'Pizza Fiesta',
      linkUrl: '/category/pizza',
      isActive: true
    }
  });
  await prisma.categoryBanner.upsert({
    where: { id: 'cb-2' },
    update: {},
    create: {
      id: 'cb-2',
      mainCategoryId: 'maincat-cafe',
      imageUrl: 'https://placehold.co/1200x400?text=Cafe+Banner',
      title: 'Cafe Specials',
      linkUrl: '/category/cafe',
      isActive: true
    }
  });

  // AppUiConfig entries
  const appUiConfigs = [
    {
      id: 'cfg-nearme-1',
      screenName: 'NEAR_ME',
      componentType: 'BANNER',
      componentName: 'Near Me Specials',
      behaviour: 'NEAR_ME',
      imageUrl: 'https://placehold.co/1200x400?text=NearMe+1',
      location: 'Chennai',
      mainCategoryId: null,
      config: { radiusKm: 5, maxItems: 10 },
      isActive: true,
      sortOrder: 1
    },
    {
      id: 'cfg-landing-1',
      screenName: 'LANDING_PAGE',
      componentType: 'SECTION',
      componentName: 'Locate',
      behaviour: 'STATIC',
      imageUrl: null,
      iconUrl: null,
      location: null,
      mainCategoryId: null,
      config: { placeholder: true },
      isActive: true,
      sortOrder: 0
    },
    {
      id: 'cfg-suggestions-1',
      screenName: 'SUGGESTIONS',
      componentType: 'BANNER',
      componentName: 'Banner-1',
      behaviour: 'STATIC',
      imageUrl: 'https://placehold.co/1200x400?text=Suggest+1',
      location: 'Chennai',
      mainCategoryId: 'maincat-cafe',
      config: { query: 'coffee', maxItems: 6 },
      isActive: true,
      sortOrder: 2
    },
    {
      id: 'cfg-chip-pizza',
      screenName: 'SUGGESTIONS',
      componentType: 'CHIP',
      componentName: 'Pizza',
      behaviour: 'CATEGORY_BASED',
      iconUrl: 'https://placehold.co/64x64?text=Pizza',
      mainCategoryId: 'maincat-pizza',
      config: { key: 'pizza_chip' },
      isActive: true,
      sortOrder: 1
    },
    {
      id: 'cfg-banner-kl',
      screenName: 'NEAR_ME',
      componentType: 'BANNER',
      componentName: 'KL Banner',
      behaviour: 'STATIC',
      imageUrl: 'https://placehold.co/1200x400?text=KL+Banner',
      location: 'Kuala Lumpur',
      mainCategoryId: null,
      config: null,
      isActive: true,
      sortOrder: 3
    }
  ];
  for (const cfg of appUiConfigs) {
    await prisma.appUiConfig.upsert({
      where: { id: cfg.id },
      update: {
        componentName: cfg.componentName,
        imageUrl: cfg.imageUrl,
        iconUrl: cfg.iconUrl,
        config: cfg.config,
        isActive: cfg.isActive,
        sortOrder: cfg.sortOrder
      },
      create: {
        id: cfg.id,
        screenName: cfg.screenName,
        componentType: cfg.componentType,
        componentName: cfg.componentName,
        behaviour: cfg.behaviour,
        iconUrl: cfg.iconUrl || null,
        imageUrl: cfg.imageUrl || null,
        location: cfg.location || null,
        mainCategoryId: cfg.mainCategoryId || null,
        config: cfg.config ? cfg.config : null,
        isActive: cfg.isActive,
        sortOrder: cfg.sortOrder
      }
    });
  }

  // Suggestion section + item
  await prisma.suggestionSection.upsert({
    where: { id: 'ss-1' },
    update: {},
    create: {
      id: 'ss-1',
      title: 'Quick Snacks',
      subtitle: 'Grab & go',
      imageUrl: null,
      type: 'QUICK_SNACK',
      mainCategoryId: 'maincat-pizza',
      config: { maxItems: 8 },
      sortOrder: 1,
      isActive: true
    }
  });

  await prisma.suggestionItem.upsert({
    where: { id: 'si-quick-1' },
    update: {},
    create: {
      id: 'si-quick-1',
      sectionId: 'ss-1',
      title: 'Pizza on the Go',
      subtitle: 'Hot & fresh',
      imageUrl: 'https://placehold.co/300x200?text=QuickPizza',
      shopId: 'shop-savarana',
      mainCategoryId: 'maincat-pizza',
      sortOrder: 1,
      isActive: true
    }
  });

  // Payments (sample transactions)
  const payments = [
    { id: 'pay-1', userId: userAlice.id, shopId: 'shop-savarana', menuName: 'Idli Plate', amount: 120, status: 'SUCCESS', createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000) },
    { id: 'pay-2', userId: userAlice.id, shopId: 'shop-savarana', menuName: 'Thali Special', amount: 350, status: 'SUCCESS', createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000) },
    { id: 'pay-3', userId: userAlice.id, shopId: 'shop-savarana', menuName: 'Family Meal', amount: 1200, status: 'SUCCESS', createdAt: new Date(Date.now() - 40 * 24 * 3600 * 1000) },
    { id: 'pay-4', userId: userBob.id, shopId: 'shop-crispy-dosa', menuName: 'Masala Dosa', amount: 150, status: 'SUCCESS', createdAt: new Date() },
    { id: 'pay-5', userId: userBob.id, shopId: 'shop-vasantha', menuName: 'Weekend Thali', amount: 375, status: 'SUCCESS', createdAt: new Date() }
  ];
  for (const p of payments) {
    await prisma.payment.upsert({
      where: { id: p.id },
      update: { amount: p.amount, status: p.status },
      create: {
        id: p.id,
        userId: p.userId,
        shopId: p.shopId,
        menuName: p.menuName,
        amount: p.amount,
        status: p.status,
        createdAt: p.createdAt
      }
    });
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });