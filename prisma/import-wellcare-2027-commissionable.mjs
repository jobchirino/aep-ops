// prisma/import-wellcare-2027-commissionable.mjs
// Importa la lista blanca de planes COMISIONABLES de Wellcare 2027.
// Uso:
//   node prisma/import-wellcare-2027-commissionable.mjs --dry-run
//   node prisma/import-wellcare-2027-commissionable.mjs
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

const CARRIER = 'WELLCARE';
const YEAR = 2027;
const DEFAULT_FILE = path.join(
  process.cwd(),
  'data',
  'AETNA_PLANES NO COMISIONABLES.xlsx'
);
const DEFAULT_SHEET = 'COMISIONABLE WELLCARE 2027';
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

function normalizePlanId(value) {
  const text = String(value || '').trim().toUpperCase();
  const match = text.match(/^([HRS]\d{4}-\d{3})(?:-\d{3})?$/);
  return match ? match[1] : text;
}

async function main() {
  const file = path.resolve(argValue('file') || DEFAULT_FILE);
  const sheetName = argValue('sheet') || DEFAULT_SHEET;

  console.log(`📄 Archivo: ${file}`);
  console.log(`📋 Hoja: ${sheetName}`);

  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(`No existe la hoja "${sheetName}" en el archivo.`);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const plans = [];

  for (const row of rows) {
    if (Number(row[0]) !== YEAR) continue;

    const state = clean(row[1]);
    const rawPlanId = clean(row[2]);
    const planName = clean(row[3]);

    if (!state || !rawPlanId || !planName) continue;

    plans.push({
      carrier: CARRIER,
      year: YEAR,
      state: state.toUpperCase(),
      planId: normalizePlanId(rawPlanId),
      rawPlanId: String(rawPlanId).trim(),
      planName: String(planName).trim(),
      planType: clean(row[4]),
      serviceArea: clean(row[5]),
    });
  }

  const byState = {};
  for (const plan of plans) {
    byState[plan.state] = (byState[plan.state] || 0) + 1;
  }

  console.log(`📊 Planes comisionables encontrados: ${plans.length}`);
  console.log('📍 Por estado:', byState);

  if (plans.length === 0) {
    console.log('⚠️ No se encontraron planes para importar.');
    return;
  }

  if (DRY_RUN) {
    console.log('');
    console.log('Muestra:');
    for (const plan of plans.slice(0, 10)) {
      console.log(
        `- ${plan.state} · ${plan.planId} · ${plan.rawPlanId} · ${plan.planName}`
      );
    }
    console.log('');
    console.log('ℹ️ Dry-run completado. No se escribió nada en la base.');
    return;
  }

  await prisma.$transaction([
    prisma.commissionablePlan.deleteMany({
      where: { carrier: CARRIER, year: YEAR },
    }),
    prisma.commissionablePlan.createMany({ data: plans }),
  ]);

  console.log('');
  console.log(`✅ Importados ${plans.length} planes comisionables de Wellcare ${YEAR}.`);
}

main()
  .catch((error) => {
    console.error('❌ Error en la importación:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
