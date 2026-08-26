import { PrismaPg } from '@prisma/adapter-pg';

import { env } from '@/config/env';
import { PrismaClient } from '@/generated/client';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

export const disconnectPrisma = async (): Promise<void> => {
  await prisma.$disconnect();
};
