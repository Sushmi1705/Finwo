// prisma/hashLegacyPins.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function main() {
  const users = await prisma.user.findMany({
    where: { securityPin: { not: null } },
    select: { id: true, securityPin: true }
  });

  console.log('Found', users.length, 'users with legacy PIN');

  for (const u of users) {
    try {
      const hash = await bcrypt.hash(u.securityPin, SALT_ROUNDS);
      await prisma.user.update({
        where: { id: u.id },
        data: { securityPinHash: hash, securityPinSet: true, securityPin: null }
      });
      console.log('Migrated user', u.id);
    } catch (err) {
      console.error('Failed migrating', u.id, err);
    }
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });