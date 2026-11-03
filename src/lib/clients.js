// src/lib/clients.js
import { prisma } from '@/lib/prisma';
import { normalizePhoneDigits, normalizeSearchName } from '@/lib/search';

/**
 * Busca clientes de Radius por nombre o teléfono para agregarlos al AEP.
 */
export async function searchClientsForNewCase(query) {
  const search = String(query || '').trim().slice(0, 80);

  if (search.length < 2) {
    return [];
  }

  const nameTerm = normalizeSearchName(search);
  const digits = normalizePhoneDigits(search);
  const orConditions = [];

  if (nameTerm.length >= 2) {
    orConditions.push({ normalizedName: { contains: nameTerm } });
  }

  if (digits.length >= 2) {
    orConditions.push({ phoneNormalized: { contains: digits } });
    orConditions.push({ cellNormalized: { contains: digits } });
  }

  if (orConditions.length === 0) {
    return [];
  }

  return prisma.client.findMany({
    where: { OR: orConditions },
    take: 25,
    orderBy: { fullName: 'asc' },
    select: {
      id: true,
      fullName: true,
      state: true,
      phone: true,
      cell: true,
      dob: true,
      mbi: true,
      aepCases: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, stage: true, category: true },
      },
    },
  });
}
