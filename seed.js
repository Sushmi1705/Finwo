// prisma/seedSuggestions.js or seed.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding suggestions data...');

  // 1) Create a Main Category (Food & Beverage)
  const mainCategory = await prisma.mainCategory.upsert({
    where: { id: 'cat-food' },
    update: {},
    create: {
      id: 'cat-food',
      name: 'Food & Beverage',
      imageUrl: 'https://example.com/images/categories/food-beverage.png',
      isActive: true,
    },
  });

  // 2) Create few shops under this category
  const pizzaHut = await prisma.shop.upsert({
    where: { id: 'shop-pizza-hut' },
    update: {},
    create: {
      id: 'shop-pizza-hut',
      categoryId: mainCategory.id,
      name: 'Pizza Hut',
      description: 'Delicious pizzas and sides',
      address: 'MG Road',
      city: 'Bangalore',
      latitude: 12.9716,
      longitude: 77.5946,
      logoUrl: 'https://example.com/images/shops/pizza-hut-logo.png',
      phoneNumber: '9999999999',
      openHours: '10:00 AM - 10:00 PM',
      avgRating: 4.3,
      reviewCount: 120,
      isActive: true,
    },
  });

  const burgerKing = await prisma.shop.upsert({
    where: { id: 'shop-burger-king' },
    update: {},
    create: {
      id: 'shop-burger-king',
      categoryId: mainCategory.id,
      name: 'Burger King',
      description: 'Burgers, fries and more',
      address: 'Brigade Road',
      city: 'Bangalore',
      latitude: 12.9732,
      longitude: 77.6050,
      logoUrl: 'https://example.com/images/shops/burger-king-logo.png',
      phoneNumber: '8888888888',
      openHours: '11:00 AM - 11:00 PM',
      avgRating: 4.1,
      reviewCount: 80,
      isActive: true,
    },
  });

  // 3) Create some menus for these shops (using upsert instead of createMany)
  await prisma.menu.upsert({
    where: { id: 'menu-pizza-margherita' },
    update: {},
    create: {
      id: 'menu-pizza-margherita',
      shopId: pizzaHut.id,
      itemName: 'Margherita Pizza',
      categoryName: 'Pizza',
      price: 199,
      imageUrl: 'https://example.com/images/menu/margherita.png',
      isAvailable: true,
    },
  });

  await prisma.menu.upsert({
    where: { id: 'menu-pizza-pepperoni' },
    update: {},
    create: {
      id: 'menu-pizza-pepperoni',
      shopId: pizzaHut.id,
      itemName: 'Pepperoni Pizza',
      categoryName: 'Pizza',
      price: 299,
      imageUrl: 'https://example.com/images/menu/pepperoni.png',
      isAvailable: true,
    },
  });

  await prisma.menu.upsert({
    where: { id: 'menu-bk-whopper' },
    update: {},
    create: {
      id: 'menu-bk-whopper',
      shopId: burgerKing.id,
      itemName: 'Whopper',
      categoryName: 'Burger',
      price: 249,
      imageUrl: 'https://example.com/images/menu/whopper.png',
      isAvailable: true,
    },
  });

  await prisma.menu.upsert({
    where: { id: 'menu-bk-fries' },
    update: {},
    create: {
      id: 'menu-bk-fries',
      shopId: burgerKing.id,
      itemName: 'French Fries',
      categoryName: 'Snacks',
      price: 99,
      imageUrl: 'https://example.com/images/menu/fries.png',
      isAvailable: true,
    },
  });

  // 4) Create Suggestion Sections

  // 4.1 NEAR_ME section
  const nearMeSection = await prisma.suggestionSection.upsert({
    where: { id: 'section-near-me' },
    update: {},
    create: {
      id: 'section-near-me',
      title: 'Near Me',
      subtitle: 'All Nearby Categories Listed',
      imageUrl: 'https://example.com/images/suggestions/near-me.png',
      type: 'NEAR_ME',
      mainCategoryId: null,
      config: {
        maxDistanceKm: 7,
      },
      sortOrder: 1,
      isActive: true,
    },
  });

  // 4.2 QUICK_SNACK section
  const quickSnackSection = await prisma.suggestionSection.upsert({
    where: { id: 'section-quick-snack' },
    update: {},
    create: {
      id: 'section-quick-snack',
      title: 'Quick Snack',
      subtitle: 'Grab a quick bite nearby',
      imageUrl: 'https://example.com/images/suggestions/quick-snack.png',
      type: 'QUICK_SNACK',
      mainCategoryId: mainCategory.id,
      config: {
        chips: ['Pizza', 'Burger', 'Snacks'],
        minRating: 3.5,
        maxDistanceKm: 5,
      },
      sortOrder: 2,
      isActive: true,
    },
  });

  // 4.3 CATEGORY_SHOPS section
  const categoryShopsSection = await prisma.suggestionSection.upsert({
    where: { id: 'section-category-food' },
    update: {},
    create: {
      id: 'section-category-food',
      title: 'Food & Beverage',
      subtitle: 'Best food places nearby',
      imageUrl: 'https://example.com/images/suggestions/food-and-beverage.png',
      type: 'CATEGORY_SHOPS',
      mainCategoryId: mainCategory.id,
      config: {},
      sortOrder: 3,
      isActive: true,
    },
  });

  // 5) Create Suggestion Items (tiles inside sections)
  await prisma.suggestionItem.upsert({
    where: { id: 'item-quick-pizza-hut' },
    update: {},
    create: {
      id: 'item-quick-pizza-hut',
      sectionId: quickSnackSection.id,
      title: 'Pizza Cravings?',
      subtitle: 'Hot & cheesy pizzas from Pizza Hut',
      imageUrl: 'https://example.com/images/suggestions/pizza-hut-tile.png',
      shopId: pizzaHut.id,
      mainCategoryId: mainCategory.id,
      sortOrder: 1,
      isActive: true,
    },
  });

  await prisma.suggestionItem.upsert({
    where: { id: 'item-quick-burger-king' },
    update: {},
    create: {
      id: 'item-quick-burger-king',
      sectionId: quickSnackSection.id,
      title: 'Burger Time',
      subtitle: 'Juicy burgers from Burger King',
      imageUrl: 'https://example.com/images/suggestions/burger-king-tile.png',
      shopId: burgerKing.id,
      mainCategoryId: mainCategory.id,
      sortOrder: 2,
      isActive: true,
    },
  });

  console.log('✅ Seeding suggestions completed');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });