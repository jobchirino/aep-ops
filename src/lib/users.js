// src/lib/users.js
import { prisma } from '@/lib/prisma';

export async function getAgents() {
  return prisma.user.findMany({
    where: { role: 'AGENT' },
    select: { id: true, name: true, shortCode: true },
    orderBy: { name: 'asc' },
  });
}
