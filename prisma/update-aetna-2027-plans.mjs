// prisma/update-aetna-2027-plans.mjs
// Importa el listado actualizado de planes NO comisionables de AETNA para 2027.
// Uso:
//   node prisma/update-aetna-2027-plans.mjs --dry-run
//   node prisma/update-aetna-2027-plans.mjs
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

try {
  loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch (error) {
  console.warn('⚠️ No se pudo cargar .env:', error.message);
}

const prisma = new PrismaClient();

const CARRIER = 'AETNA';
const YEAR = 2027;
const DEFAULT_FILE = path.join(
  process.cwd(),
  'data',
  'AETNA_PLANES NO COMISIONABLES.xlsx'
);
const DEFAULT_SHEET = 'base_aetna';

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

function cleanState(value) {
  const text = clean(value);
  return text ? text.toUpperCase() : null;
}

function extractPlanId(value) {
  const text = clean(value);
  if (!text) return null;
  const cleaned = text.toUpperCase().replace(/[|:]/g, '-').replace(/\s+/g, '');
  const match = cleaned.match(/([HRS]\d{4}-\d{3})/i);
  return match ? match[1].toUpperCase() : null;
}

function keyOf(row) {
  return `${row.state}|${row.planId}`;
}

async function main() {
  const file = argValue('file') || DEFAULT_FILE;
  const sheet = argValue('sheet') || DEFAULT_SHEET;
  const dryRun = process.argv.includes('--dry-run');

  if (!fs.existsSync(file)) {
    throw new Error(`No se encontró el archivo: ${file}`);
  }

  const workbook = XLSX.readFile(file);
  if (!workbook.Sheets[sheet]) {
    throw new Error(`No existe la hoja "${sheet}" en ${path.basename(file)}.`);
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { defval: null });

  const records = [];
  const seen = new Set();
  const invalid = [];

  for (const row of rows) {
    if (Number(row.YEAR) !== YEAR) continue;

    const state = cleanState(row.STATE);
    const planId = extractPlanId(row['PLAN ID']);
    const planName = clean(row.NAME);
    const rawPlanId = clean(row['PLAN ID']);

    if (!state || !planId || !planName) {
      invalid.push({ row, state, planId, planName });
      continue;
    }

    const record = {
      carrier: CARRIER,
      year: YEAR,
      state,
      planId,
      rawPlanId,
      planName,
      planType: clean(row.TYPE),
      serviceArea: clean(row['SERVICES AREA']),
      statusNote: clean(row['GARANTIZADO/CONFIRMADO']) || 'No Comisionable',
    };

    const key = keyOf(record);
    if (seen.has(key)) continue;
    seen.add(key);
    records.push(record);
  }

  if (invalid.length > 0) {
    console.error('❌ Filas inválidas:', invalid.length);
    console.error(invalid.slice(0, 5));
    throw new Error('Corrige las filas inválidas antes de importar.');
  }

  if (records.length === 0) {
    throw new Error(`No se encontraron planes ${CARRIER} ${YEAR} en la hoja ${sheet}.`);
  }

  const current = await prisma.nonCommissionablePlan.findMany({
    where: { carrier: CARRIER, year: YEAR },
    orderBy: [{ state: 'asc' }, { planId: 'asc' }],
  });

  const currentKeys = new Set(current.map((row) => keyOf(row)));
  const newKeys = new Set(records.map((row) => keyOf(row)));
  const added = [...newKeys].filter((key) => !currentKeys.has(key));
  const removed = [...currentKeys].filter((key) => !newKeys.has(key));

  console.log('Archivo:', file);
  console.log('Hoja:', sheet);
  console.log(`Planes ${CARRIER} ${YEAR} en el archivo:`, records.length);
  console.log(`Planes ${CARRIER} ${YEAR} actualmente en DB:`, current.length);
  console.log('Nuevos:', added.length);
  console.log('Se eliminarán (no están en el archivo):', removed.length);
  if (added.length) console.log('  +', added.slice(0, 10).join(', '), added.length > 10 ? '…' : '');
  if (removed.length) console.log('  -', removed.slice(0, 10).join(', '), removed.length > 10 ? '…' : '');
  console.log('Muestra:', records.slice(0, 3).map((row) => `${row.state} ${row.planId} · ${row.planName}`));

  if (dryRun) {
    console.log('🧪 Dry-run: no se modificó la base.');
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(process.cwd(), 'data', `backup-aetna-2027-${stamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(current, null, 2), 'utf8');
  console.log('💾 Respaldo guardado en:', backupFile);

  const [deleted, inserted] = await prisma.$transaction([
    prisma.nonCommissionablePlan.deleteMany({
      where: { carrier: CARRIER, year: YEAR },
    }),
    prisma.nonCommissionablePlan.createMany({
      data: records,
    }),
  ]);

  console.log('🗑️ Eliminados:', deleted.count);
  console.log('✅ Insertados:', inserted.count);
  console.log(
    'Total actualizado:',
    await prisma.nonCommissionablePlan.count({ where: { carrier: CARRIER, year: YEAR } })
  );

  const sample = await prisma.nonCommissionablePlan.findMany({
    where: { carrier: CARRIER, year: YEAR, state: 'NJ' },
    orderBy: { planId: 'asc' },
    take: 5,
    select: { planId: true, planName: true, state: true, year: true },
  });
  console.log('Muestra NJ:', sample);
}

main()
  .catch((error) => {
    console.error('❌ Error importando planes:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
