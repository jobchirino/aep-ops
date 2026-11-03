// src/lib/prisma.js
import { PrismaClient } from '@prisma/client';

// En desarrollo Next.js recarga los módulos en cada cambio. Guardar el cliente
// en globalThis evita crear una conexión nueva por cada recarga.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
