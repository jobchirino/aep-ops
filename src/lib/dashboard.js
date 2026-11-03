// src/lib/dashboard.js
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizePhoneDigits, normalizeSearchName } from '@/lib/search';

const LIST_LIMIT = 300;

function buildWhere({ stage, agent, userId, searchTerm }) {
  const conditions = [];

  if (stage) {
    conditions.push(Prisma.sql`a.stage = ${stage}`);
  }

  if (agent === 'mine') {
    conditions.push(Prisma.sql`a."assignedToId" = ${userId}`);
  } else if (agent === 'unassigned') {
    conditions.push(Prisma.sql`a."assignedToId" IS NULL`);
  }

  const search = String(searchTerm || '').trim().slice(0, 80);

  if (search.length >= 2) {
    const nameTerm = normalizeSearchName(search);
    const digits = normalizePhoneDigits(search);
    const searchConditions = [];

    if (nameTerm.length >= 2) {
      searchConditions.push(Prisma.sql`c."normalizedName" LIKE ${`%${nameTerm}%`}`);
    }

    if (digits.length >= 2) {
      searchConditions.push(Prisma.sql`c."phoneNormalized" LIKE ${`%${digits}%`}`);
      searchConditions.push(Prisma.sql`c."cellNormalized" LIKE ${`%${digits}%`}`);
    }

    if (searchConditions.length > 0) {
      conditions.push(Prisma.sql`(${Prisma.join(searchConditions, ' OR ')})`);
    }
  }

  if (conditions.length === 0) {
    return Prisma.empty;
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

/**
 * Consulta el dashboard en dos viajes a la base:
 * 1. Totales globales por categoría y etapa cerrada.
 * 2. Lista filtrada con cliente, agente, bloqueo y última nota (LATERAL).
 */
export async function getDashboardData({ stage, agent, userId, searchTerm }) {
  const whereSql = buildWhere({ stage, agent, userId, searchTerm });

  const [statsRows, rows] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE category = 'NO_RENOVABLE')::int AS "noRenovable",
        COUNT(*) FILTER (WHERE category = 'NO_COMISIONABLE')::int AS "noComisionable",
        COUNT(*) FILTER (WHERE category = 'CANCELADO')::int AS "cancelado",
        COUNT(*) FILTER (WHERE category = 'ENTRANTE')::int AS "entrante",
        COUNT(*) FILTER (WHERE stage = 'CERRADO_DOCS_ENVIADOS')::int AS "closed"
      FROM "AepCase"
    `,
    prisma.$queryRaw(Prisma.sql`
      SELECT
        a.id AS "id",
        a.stage AS "stage",
        a."currentPlanName" AS "currentPlanName",
        a."currentCarrier" AS "currentCarrier",
        a."eligibleHorizonCsnp" AS "eligibleHorizonCsnp",
        c."fullName" AS "clientFullName",
        c.state AS "clientState",
        c.phone AS "clientPhone",
        c.cell AS "clientCell",
        c."radiusUrl" AS "clientRadiusUrl",
        ua.name AS "assignedName",
        ua."shortCode" AS "assignedShortCode",
        ua.id AS "assignedId",
        ul.name AS "lockedName",
        ul."shortCode" AS "lockedShortCode",
        lt.content AS "lastNoteContent",
        lt."createdAt" AS "lastNoteCreatedAt",
        ut.name AS "lastNoteUserName",
        ut."shortCode" AS "lastNoteUserShortCode"
      FROM "AepCase" a
      JOIN "Client" c ON c.id = a."clientId"
      LEFT JOIN "User" ua ON ua.id = a."assignedToId"
      LEFT JOIN "User" ul ON ul.id = a."lockedByUserId"
      LEFT JOIN LATERAL (
        SELECT te.content, te."createdAt", te."userId"
        FROM "TimelineEvent" te
        WHERE te."caseId" = a.id
        ORDER BY te."createdAt" DESC
        LIMIT 1
      ) lt ON TRUE
      LEFT JOIN "User" ut ON ut.id = lt."userId"
      ${whereSql}
      ORDER BY a."nextFollowUpAt" ASC NULLS LAST, a."createdAt" DESC
      LIMIT ${LIST_LIMIT}
    `),
  ]);

  const stats = statsRows[0] || {
    noRenovable: 0,
    noComisionable: 0,
    cancelado: 0,
    entrante: 0,
    closed: 0,
  };

  const cases = rows.map((row) => ({
    id: row.id,
    stage: row.stage,
    currentPlanName: row.currentPlanName,
    currentCarrier: row.currentCarrier,
    eligibleHorizonCsnp: row.eligibleHorizonCsnp,
    client: {
      fullName: row.clientFullName,
      state: row.clientState,
      phone: row.clientPhone,
      cell: row.clientCell,
      radiusUrl: row.clientRadiusUrl,
    },
    assignedTo: row.assignedName
      ? { id: row.assignedId, name: row.assignedName, shortCode: row.assignedShortCode }
      : null,
    lockedByUser: row.lockedName
      ? { name: row.lockedName, shortCode: row.lockedShortCode }
      : null,
    timeline: row.lastNoteContent
      ? [
          {
            content: row.lastNoteContent,
            createdAt: row.lastNoteCreatedAt,
            user: row.lastNoteUserName
              ? { name: row.lastNoteUserName, shortCode: row.lastNoteUserShortCode }
              : null,
          },
        ]
      : [],
  }));

  return {
    cases,
    stats,
    totalCases:
      stats.noRenovable + stats.noComisionable + stats.cancelado + stats.entrante,
  };
}
