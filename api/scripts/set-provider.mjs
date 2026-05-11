/**
 * Usage (from repo root, same DATABASE_URL as the API):
 *   node scripts/set-provider.mjs you@example.com
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const email = process.argv[2]?.trim();
if (!email) {
  console.error('Usage: node scripts/set-provider.mjs <email>');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const normalized = email.toLowerCase();
  const found = await prisma.user.findFirst({
    where: {
      OR: [{ email: email }, { email: normalized }],
    },
    select: { id: true },
  });
  if (!found) {
    console.error(`No user found for email: ${email}`);
    process.exit(1);
  }
  const user = await prisma.user.update({
    where: { id: found.id },
    data: { provider: true },
    select: { id: true, email: true, name: true, provider: true },
  });
  console.log('Updated:', user);
} catch (e) {
  console.error(e?.message || e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
