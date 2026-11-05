// prisma/import-leads.mjs
// Importa los leads del CSV de Radius a la tabla Client con source = 'LEAD'.
// Uso:
//   node prisma/import-leads.mjs --dry-run
//   node prisma/import-leads.mjs
//   node prisma/import-leads.mjs --file=data/otro-archivo.csv
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

try {
  loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch (error) {
  console.warn('⚠️ No se pudo cargar .env:', error.message);
}

const prisma = new PrismaClient();

const DEFAULT_FILE = path.join(process.cwd(), 'data', 'leads_26_11_05.csv');
const DRY_RUN = process.argv.includes('--dry-run');

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
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, '');
  return digits || null;
}

function formatDob(value) {
  if (value === null || value === undefined || value === '') return null;

  const currentYear = new Date().getFullYear();

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(Math.floor(value));
    if (!parsed || parsed.y > currentYear) return null;
    const month = String(parsed.m).padStart(2, '0');
    const day = String(parsed.d).padStart(2, '0');
    return `${month}/${day}/${parsed.y}`;
  }

  const text = String(value).trim();
  if (!text) return null;

  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    if (Number(match[3]) > currentYear) return null;
    return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}`;
  }

  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  if (yearMatch && Number(yearMatch[0]) > currentYear) return null;

  return text;
}

function makeLeadRecordId(externalId, normalizedName, phoneDigits, email) {
  if (externalId) {
    return `LEAD_${externalId}`;
  }

  const hash = crypto
    .createHash('sha1')
    .update(`${normalizedName}|${phoneDigits || ''}|${email || ''}`)
    .digest('hex')
    .slice(0, 20);

  return `LEAD_HASH_${hash}`;
}

const LEAD_DATA_FIELDS = [
  'fullName',
  'normalizedName',
  'phone',
  'phoneNormalized',
  'cell',
  'cellNormalized',
  'email',
  'address',
  'city',
  'state',
  'zip',
  'dob',
  'gender',
  'masterRecordId',
  'radiusUrl',
  'source',
  'leadStatus',
  'leadTemperature',
  'leadTags',
  'leadAssignedUser',
];

function sameLeadData(existing, data) {
  return LEAD_DATA_FIELDS.every(
    (field) => (existing[field] ?? null) === (data[field] ?? null)
  );
}

async function main() {
  const file = path.resolve(argValue('file') || DEFAULT_FILE);

  if (!file || !path.isAbsolute(file)) {
    throw new Error('Ruta de archivo inválida.');
  }

  console.log(`📄 Archivo: ${file}`);
  console.log(`🧪 Modo: ${DRY_RUN ? 'DRY-RUN (no escribe)' : 'IMPORTACIÓN REAL'}`);

  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  console.log(`📊 Filas del CSV: ${rows.length}`);

  const existingClients = await prisma.client.findMany({
    select: {
      id: true,
      radiusRecordId: true,
      fullName: true,
      normalizedName: true,
      phone: true,
      phoneNormalized: true,
      cell: true,
      cellNormalized: true,
      email: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      dob: true,
      gender: true,
      masterRecordId: true,
      radiusUrl: true,
      source: true,
      leadStatus: true,
      leadTemperature: true,
      leadTags: true,
      leadAssignedUser: true,
    },
  });

  const byRecordId = new Map();
  const byName = new Map();
  const allPhones = new Set();

  function registerClient(client) {
    const previous = byRecordId.get(client.radiusRecordId);

    if (previous && previous.normalizedName !== client.normalizedName) {
      const previousList = byName.get(previous.normalizedName);

      if (previousList) {
        const previousIndex = previousList.findIndex(
          (item) => item.radiusRecordId === client.radiusRecordId
        );

        if (previousIndex >= 0) {
          previousList.splice(previousIndex, 1);
        }
      }
    }

    byRecordId.set(client.radiusRecordId, client);

    if (!byName.has(client.normalizedName)) {
      byName.set(client.normalizedName, []);
    }

    const sameName = byName.get(client.normalizedName);
    const existingIndex = sameName.findIndex(
      (item) => item.radiusRecordId === client.radiusRecordId
    );

    if (existingIndex >= 0) {
      sameName[existingIndex] = client;
    } else {
      sameName.push(client);
    }

    if (client.phoneNormalized) allPhones.add(client.phoneNormalized);
    if (client.cellNormalized) allPhones.add(client.cellNormalized);
  }

  for (const client of existingClients) {
    registerClient(client);
  }

  let invalid = 0;
  let skippedDuplicates = 0;
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let noPhone = 0;
  let phoneOnlyMatch = 0;
  let nameOnlyMatch = 0;

  const skippedSamples = [];
  const noPhoneSamples = [];
  const toCreate = [];
  const toUpdate = [];

  for (const row of rows) {
    const rawName = clean(row.Name);

    if (!rawName) {
      invalid += 1;
      continue;
    }

    const normalizedName = normalizeName(rawName);

    if (!normalizedName) {
      invalid += 1;
      continue;
    }

    const phoneRaw = clean(row.Phone);
    const cellRaw = clean(row.Cell);
    const phoneDigits = digitsOnly(phoneRaw);
    const cellDigits = digitsOnly(cellRaw);
    const phoneCandidates = [...new Set([phoneDigits, cellDigits].filter(Boolean))];

    if (phoneCandidates.length === 0) {
      noPhone += 1;
      if (noPhoneSamples.length < 8) {
        noPhoneSamples.push(rawName);
      }
    }

    const externalId = clean(row['Record ID']) || clean(row['Master Record ID']);
    const email = clean(row.Email);
    const radiusRecordId = makeLeadRecordId(
      externalId,
      normalizedName,
      phoneCandidates[0] || null,
      email
    );

    const sameRecord = byRecordId.get(radiusRecordId);
    const nameMatches = byName.get(normalizedName) || [];

    const duplicate = nameMatches.find(
      (client) =>
        client.radiusRecordId !== radiusRecordId &&
        phoneCandidates.some(
          (phone) =>
            client.phoneNormalized === phone || client.cellNormalized === phone
        )
    );

    // Regla del negocio: solo se omite cuando coinciden el nombre Y el teléfono.
    // Si solo coincide el teléfono (parejas), el lead sí se importa.
    if (!sameRecord && duplicate) {
      skippedDuplicates += 1;

      if (skippedSamples.length < 10) {
        skippedSamples.push({
          lead: rawName,
          phone: phoneCandidates[0] || '',
          matchedClient: duplicate.fullName,
          matchedSource: duplicate.source,
        });
      }

      continue;
    }

    const data = {
      fullName: rawName,
      normalizedName,
      phone: phoneRaw,
      phoneNormalized: phoneDigits,
      cell: cellRaw,
      cellNormalized: cellDigits,
      email,
      address: clean(row.Address),
      city: clean(row.City),
      state: clean(row.State),
      zip: clean(row.Zip),
      dob: formatDob(row['Date of Birth']),
      gender: clean(row.Gender),
      masterRecordId: clean(row['Master Record ID']),
      radiusUrl: clean(row['Link To Record']),
      source: 'LEAD',
      leadStatus: clean(row.Status),
      leadTemperature: clean(row.Temperature),
      leadTags: clean(row.Tags),
      leadAssignedUser: clean(row['Assigned User']),
    };

    if (sameRecord) {
      if (sameLeadData(sameRecord, data)) {
        unchanged += 1;
      } else {
        updated += 1;
        toUpdate.push({ radiusRecordId, data });
      }

      registerClient({
        ...sameRecord,
        ...data,
        id: sameRecord.id,
        radiusRecordId,
      });
      continue;
    }

    created += 1;

    if (phoneCandidates.some((phone) => allPhones.has(phone))) {
      phoneOnlyMatch += 1;
    }

    if (nameMatches.length > 0) {
      nameOnlyMatch += 1;
    }

    const createData = { radiusRecordId, ...data };
    toCreate.push(createData);
    registerClient({
      ...createData,
      id: `pending-${radiusRecordId}`,
    });
  }

  if (!DRY_RUN && toCreate.length > 0) {
    const CHUNK_SIZE = 400;

    for (let index = 0; index < toCreate.length; index += CHUNK_SIZE) {
      const chunk = toCreate.slice(index, index + CHUNK_SIZE);
      await prisma.client.createMany({ data: chunk, skipDuplicates: true });
      console.log(
        `   Creados ${Math.min(index + CHUNK_SIZE, toCreate.length)}/${toCreate.length}...`
      );
    }
  }

  if (!DRY_RUN && toUpdate.length > 0) {
    const CHUNK_SIZE = 25;

    for (let index = 0; index < toUpdate.length; index += CHUNK_SIZE) {
      const chunk = toUpdate.slice(index, index + CHUNK_SIZE);
      await Promise.all(
        chunk.map(({ radiusRecordId, data }) =>
          prisma.client.update({ where: { radiusRecordId }, data })
        )
      );
      console.log(
        `   Actualizados ${Math.min(index + CHUNK_SIZE, toUpdate.length)}/${toUpdate.length}...`
      );
    }
  }

  console.log('');
  console.log('=== RESUMEN ===');
  console.log(`Filas leídas: ${rows.length}`);
  console.log(`Sin nombre (omitidos): ${invalid}`);
  console.log(`Omitidos por nombre + teléfono ya existente: ${skippedDuplicates}`);
  console.log(`Leads nuevos: ${created}`);
  console.log(`Leads actualizados: ${updated}`);
  console.log(`Leads sin cambios: ${unchanged}`);
  console.log(`Leads sin teléfono (se importan igual): ${noPhone}`);
  console.log(`Coinciden solo por teléfono, nombre distinto (se importan): ${phoneOnlyMatch}`);
  console.log(`Coinciden solo por nombre, teléfono distinto (se importan): ${nameOnlyMatch}`);
  console.log(
    `Total de clientes/leads en la base después del proceso: ${existingClients.length + created}`
  );

  if (skippedSamples.length > 0) {
    console.log('');
    console.log('Ejemplos omitidos por nombre + teléfono:');
    for (const sample of skippedSamples) {
      console.log(
        `- ${sample.lead} · ${sample.phone} → ya existe: ${sample.matchedClient} (${sample.matchedSource})`
      );
    }
  }

  if (noPhoneSamples.length > 0) {
    console.log('');
    console.log('Ejemplos sin teléfono (se importan, revisar luego):');
    for (const name of noPhoneSamples) {
      console.log(`- ${name}`);
    }
  }

  if (DRY_RUN) {
    console.log('');
    console.log('ℹ️ Dry-run completado. No se escribió nada en la base.');
  }
}

main()
  .catch((error) => {
    console.error('❌ Error en la importación:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
