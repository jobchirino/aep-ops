// prisma/import-clover-reenroll.mjs
// Importa los clientes del listado Clover ReEnroll 2027 al AEP.
// Uso:
//   node prisma/import-clover-reenroll.mjs --dry-run
//   node prisma/import-clover-reenroll.mjs
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

try {
  loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch (error) {
  console.warn('⚠️ No se pudo cargar .env:', error.message);
}

const prisma = new PrismaClient();

const CATEGORY = 'CLOVER_REENROLL';
const DEFAULT_FILE = path.join(process.cwd(), 'data', 'CLOVER_REENROLL_2027.xlsx');
const DRY_RUN = process.argv.includes('--dry-run');

// El archivo no trae fila de encabezados. Estas son las posiciones reales.
const COL = {
  cp: 0,
  memberId: 1,
  planCode: 2,
  firstName: 6,
  lastName: 7,
  language: 9,
  dob: 10,
  phone: 11,
  gender: 12,
  address: 13,
  address2: 14,
  city: 16,
  state: 17,
  zip: 18,
  fmo: 19,
  agentId: 20,
  agentFirst: 21,
  agentLast: 22,
};

function argValue(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function clean(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function normalizeName(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\(.*?\)/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function digitsOnly(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

function alnum(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function formatDob(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(Math.floor(value));
    if (!parsed) return null;
    return `${String(parsed.m).padStart(2, '0')}/${String(parsed.d).padStart(2, '0')}/${parsed.y}`;
  }

  const text = String(value).trim();
  if (!text) return null;
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return text;
  return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}`;
}

function sameDob(a, b) {
  const left = formatDob(a);
  const right = formatDob(b);
  return Boolean(left && right && left === right);
}

function positivePhone(client, phone) {
  return Boolean(
    phone && (client.phoneNormalized === phone || client.cellNormalized === phone)
  );
}

function levenshtein(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  const rows = Array.from({ length: a.length + 1 }, () => []);

  for (let i = 0; i <= a.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost
      );
    }
  }

  return rows[a.length][b.length];
}

function chooseMatch(row, clients) {
  const cpMatches = row.cp
    ? clients.filter((client) =>
        String(client.memberId || '').toUpperCase().includes(row.cp.toUpperCase())
      )
    : [];
  const mbiMatches = row.memberId
    ? clients.filter(
        (client) =>
          alnum(client.mbi) === alnum(row.memberId) ||
          alnum(client.memberId).includes(alnum(row.memberId))
      )
    : [];
  const nameDobMatches = clients.filter(
    (client) =>
      client.normalizedName === row.normalizedName && sameDob(client.dob, row.dob)
  );
  const namePhoneMatches = clients.filter(
    (client) =>
      client.normalizedName === row.normalizedName && positivePhone(client, row.phone)
  );
  const phoneDobMatches = clients.filter(
    (client) => positivePhone(client, row.phone) && sameDob(client.dob, row.dob)
  );
  const nameMatches = clients.filter(
    (client) => client.normalizedName === row.normalizedName
  );
  const phoneMatches = clients.filter((client) => positivePhone(client, row.phone));

  const candidates = [
    { list: cpMatches, method: 'CP', confidence: 'high' },
    { list: mbiMatches, method: 'MBI', confidence: 'high' },
    { list: nameDobMatches, method: 'nombre + DOB', confidence: 'high' },
    { list: namePhoneMatches, method: 'nombre + teléfono', confidence: 'high' },
    { list: phoneDobMatches, method: 'teléfono + DOB', confidence: 'review' },
    { list: nameMatches, method: 'solo nombre', confidence: 'review' },
  ];

  for (const candidate of candidates) {
    if (candidate.list.length === 1) {
      return {
        ...candidate,
        selected: candidate.list[0],
      };
    }
  }

  const nearMatches = clients.filter((client) => {
    if (!sameDob(client.dob, row.dob)) return false;

    const nameDistance = levenshtein(client.normalizedName, row.normalizedName);
    const memberIdDistance =
      row.memberId && client.mbi
        ? levenshtein(alnum(client.mbi), alnum(row.memberId))
        : Number.POSITIVE_INFINITY;

    return nameDistance <= 2 || memberIdDistance <= 1;
  });

  if (nearMatches.length === 1) {
    return {
      list: nearMatches,
      selected: nearMatches[0],
      method: 'coincidencia aproximada',
      confidence: 'review',
    };
  }

  if (nearMatches.length > 1) {
    return {
      selected: null,
      method: 'varias coincidencias aproximadas',
      confidence: 'ambiguous',
      candidates: nearMatches,
    };
  }

  const ids = new Set();
  for (const candidate of candidates) {
    for (const client of candidate.list) ids.add(client.id);
  }

  if (ids.size === 0) {
    return { selected: null, method: '—', confidence: 'none' };
  }

  return {
    selected: null,
    method: 'múltiples coincidencias',
    confidence: 'ambiguous',
    candidates: clients.filter((client) => ids.has(client.id)),
  };
}

async function loadRows(file) {
  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  return rawRows
    .map((raw, index) => {
      const firstName = clean(raw[COL.firstName]);
      const lastName = clean(raw[COL.lastName]);
      const fullName = [firstName, lastName].filter(Boolean).join(' ');

      if (!fullName) return null;

      return {
        index,
        cp: clean(raw[COL.cp]),
        memberId: clean(raw[COL.memberId]),
        planCode: clean(raw[COL.planCode]),
        fullName,
        normalizedName: normalizeName(fullName),
        dob: formatDob(raw[COL.dob]),
        phone: digitsOnly(raw[COL.phone]),
        language: clean(raw[COL.language]),
        gender: clean(raw[COL.gender]),
        address: [clean(raw[COL.address]), clean(raw[COL.address2])]
          .filter(Boolean)
          .join(', '),
        city: clean(raw[COL.city]),
        state: clean(raw[COL.state]),
        zip: clean(raw[COL.zip]),
        agent: [clean(raw[COL.agentFirst]), clean(raw[COL.agentLast])]
          .filter(Boolean)
          .join(' '),
      };
    })
    .filter(Boolean);
}

async function getEvaluation() {
  const file = path.resolve(argValue('file') || DEFAULT_FILE);
  const rows = await loadRows(file);

  const clients = await prisma.client.findMany({
    select: {
      id: true,
      fullName: true,
      normalizedName: true,
      dob: true,
      phone: true,
      phoneNormalized: true,
      cell: true,
      cellNormalized: true,
      memberId: true,
      mbi: true,
      radiusRecordId: true,
      source: true,
      aepCases: {
        select: { id: true, category: true, stage: true },
      },
    },
  });

  return rows.map((row) => {
    const match = chooseMatch(row, clients);
    const selected = match.selected;
    let status = 'ready';
    let reason = match.method;

    if (!selected) {
      status = match.confidence === 'ambiguous' ? 'ambiguous' : 'not_found';
      reason = match.method;
    } else if (selected.source !== 'RADIUS') {
      status = 'review';
      reason = `coincide con ${selected.source}, no con un cliente Radius`;
    } else if (
      selected.dob &&
      row.dob &&
      formatDob(selected.dob) !== row.dob
    ) {
      status = 'review';
      reason = `DOB distinto (${formatDob(selected.dob)} vs ${row.dob})`;
    } else if (match.confidence === 'review') {
      status = 'review';
      reason = `${match.method}; nombre distinto`;
    }

    if (selected?.aepCases?.length > 0) {
      const existing = selected.aepCases[0];

      if (existing.category === CATEGORY) {
        status = 'already_imported';
        reason = 'ya tiene un caso Clover ReEnroll';
      } else {
        status = 'conflict';
        reason = `ya tiene caso ${existing.category} (${existing.stage})`;
      }
    }

    return {
      row,
      match,
      selected,
      status,
      reason,
    };
  });
}

function report(evaluation, dryRun) {
  const counts = {
    ready: 0,
    review: 0,
    not_found: 0,
    ambiguous: 0,
    conflict: 0,
    already_imported: 0,
  };

  for (const item of evaluation) {
    counts[item.status] += 1;
  }

  console.log('');
  console.log(`📄 Filas: ${evaluation.length}`);
  console.log(`✅ Listas para crear: ${counts.ready}`);
  console.log(`⚠️ Para revisar: ${counts.review + counts.ambiguous + counts.not_found}`);
  console.log(`🔁 Ya importadas: ${counts.already_imported}`);
  console.log(`⛔ Conflictos con otro caso: ${counts.conflict}`);
  console.log(`🧪 Modo: ${dryRun ? 'DRY-RUN' : 'IMPORTACIÓN REAL'}`);
  console.log('');

  for (const item of evaluation) {
    const { row, selected, status, reason } = item;
    const detail = selected
      ? `${selected.fullName} · ${selected.radiusRecordId} · ${selected.source}`
      : 'sin cliente seleccionado';

    console.log(
      `[${status}] ${row.fullName} · CP ${row.cp || '—'} · ${row.dob || '—'} · ${row.phone || '—'}`
    );
    console.log(`   ${detail} · ${reason}`);
  }
}

async function main() {
  const file = path.resolve(argValue('file') || DEFAULT_FILE);
  console.log(`📄 Archivo: ${file}`);

  const evaluation = await getEvaluation();
  const conflicts = evaluation.filter((item) => item.status === 'conflict');
  const ready = evaluation.filter((item) => item.status === 'ready');

  report(evaluation, DRY_RUN);

  if (DRY_RUN) {
    console.log('');
    console.log('ℹ️ Dry-run completado. No se escribió nada en la base.');
    return;
  }

  if (conflicts.length > 0) {
    console.log('');
    console.log('⛔ Importación detenida: hay clientes con un caso AEP de otra categoría.');
    console.log('   Revisa los conflictos antes de volver a ejecutar.');
    process.exitCode = 1;
    return;
  }

  if (ready.length === 0) {
    console.log('');
    console.log('No hay casos nuevos por crear.');
    return;
  }

  const importer = await prisma.user.findFirst({
    where: { role: 'AGENT' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  let created = 0;

  for (const item of ready) {
    const { row, selected } = item;

    if (!selected) continue;

    const planName = row.planCode ? `Clover ${row.planCode}` : 'Clover';

    try {
      const newCase = await prisma.aepCase.create({
        data: {
          clientId: selected.id,
          category: CATEGORY,
          currentCarrier: 'Clover',
          currentPlanName: planName,
          currentPlanId: row.planCode || null,
          policyId: row.cp || null,
          radiusStatus: 'Active',
          stage: 'SIN_CONTACTAR',
          assignedToId: null,
          actionRequired: null,
          caseNotesSummary: 'Clover ReEnroll 2027',
        },
        select: { id: true },
      });

      if (importer) {
        const content = 'Caso creado desde listado Clover ReEnroll 2027';

        await prisma.timelineEvent.create({
          data: {
            caseId: newCase.id,
            userId: importer.id,
            eventType: 'NOTE',
            content,
            radiusFormattedNote: `[IMPORTACIÓN CLOVER 2027]: ${content}`,
          },
        });
      }

      created += 1;
      console.log(`✅ ${selected.fullName} → caso ${newCase.id}`);
    } catch (error) {
      console.error(`❌ Error con ${selected.fullName}:`, error.message);
      throw error;
    }
  }

  console.log('');
  console.log(`✅ Casos creados: ${created}`);
  console.log('ℹ️ Los clientes para revisar no fueron modificados.');
}

main()
  .catch((error) => {
    console.error('❌ Error en la importación:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
