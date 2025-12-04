import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const userId = 'e16c895a-f37b-43e9-b858-9db09c5b76c0';
  const shopId = '882d6458-218d-4ba9-8870-4448c84350b7';

  // Create some dummy notifications
  await prisma.notification.createMany({
    data: [
      {
        userId,
        title: `Give a review for last shopping at ${shopId} and get cashback!`,
        body: `Please review your recent visit to the shop.`,
        type: 'review',
        amount: null,
        meta: { shopId },
        isActionable: true,
        createdAt: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
      },
      {
        userId,
        title: '₹ 150.00 Payment successfully sent to the style zone',
        body: 'Your payment of ₹150.00 is complete',
        type: 'payment',
        amount: 150.0,
        meta: { paymentId: 'payment-123', status: 'completed' },
        isActionable: true,
        createdAt: new Date(Date.now() - 50 * 60 * 1000), // 50 minutes ago
      },
      {
        userId,
        title: 'Add money to Finwo money to easy transactions',
        body: 'Add money to your wallet for faster payments',
        type: 'promo',
        amount: null,
        meta: {},
        isActionable: false,
        createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      },
      {
        userId,
        title: '₹ 5.00 cashback received. Added to payout',
        body: 'You received ₹5 cashback from your last purchase',
        type: 'cashback',
        amount: 5.0,
        meta: {},
        isActionable: false,
        createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      },
      {
        userId,
        title: '₹ 550.00 Payment successfully sent to the Pizza Hut',
        body: 'Your payment of ₹550.00 is complete',
        type: 'payment',
        amount: 550.0,
        meta: { paymentId: 'payment-456', shopId, status: 'completed' },
        isActionable: true,
        createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      },
    ],
  });

  console.log('Dummy notifications created');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });