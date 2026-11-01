import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function connectDb() {
  try {
    await prisma.$connect();
    console.log('📦 Database connected successfully via Prisma');
  } catch (err) {
    console.error('❌ Database connection failed:', err);
  }
}
