import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });
}

export { prisma };