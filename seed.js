import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Seed Quick Snack Categories
  const categories = [
    { name: 'Pizza', iconUrl: 'https://placehold.co/100x100/e74c3c/white?text=🍕', sortOrder: 1 },
    { name: 'Burger', iconUrl: 'https://placehold.co/100x100/f39c12/white?text=🍔', sortOrder: 2 },
    { name: 'Tea', iconUrl: 'https://placehold.co/100x100/16a085/white?text=🍵', sortOrder: 3 },
    { name: 'Chats', iconUrl: 'https://placehold.co/100x100/9b59b6/white?text=🥘', sortOrder: 4 },
    { name: 'Coffee', iconUrl: 'https://placehold.co/100x100/34495e/white?text=☕', sortOrder: 5 },
    { name: 'Sandwich', iconUrl: 'https://placehold.co/100x100/27ae60/white?text=🥪', sortOrder: 6 },
  ];

  for (const cat of categories) {
    await prisma.quickSnackCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  console.log('✅ Quick Snack Categories seeded');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });