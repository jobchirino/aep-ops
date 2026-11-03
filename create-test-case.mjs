// create-test-case.mjs
// Crea (o resetea) un caso ficticio para probar el flujo completo sin tocar data real.
//
// Uso:
//   node create-test-case.mjs
//   node create-test-case.mjs --delete
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const TEST_RADIUS_ID = 'TEST-9999';
const NOTE_CONTENT = 'Cliente ficticio para testear todo el flujo';

try {
  loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url)));
} catch (error) {
  console.warn('⚠️ No se pudo cargar .env:', error.message);
}

const prisma = new PrismaClient();

const testClientData = {
  fullName: 'John Doe Prueba',
  normalizedName: 'JOHN DOE PRUEBA',
  dob: '05/15/1950',
  gender: 'M',
  phone: '(201) 555-0199',
  cell: '(201) 555-0199',
  phoneNormalized: '2015550199',
  cellNormalized: '2015550199',
  email: 'john.doe.test@example.com',
  address: '123 Test Street',
  city: 'Newark',
  state: 'NJ',
  zip: '07102',
  county: 'ESSEX',
  mbi: '1EG4-TE5-MK73',
  memberId: 'TEST-MEMBER-9999',
  partADate: '01/01/2010',
  partBDate: '01/01/2010',
  lis: 'NO',
  paad: 'NO',
  radiusUrl: 'https://app.radiusbob.com/',
  rawPoliciesJson: [
    {
      carrier: 'Aetna',
      product: 'Aetna Medicare Prime (HMO) H5521-392',
      status: 'Active',
      policyNo: 'TEST-POL-001',
      customerNumber: 'TEST-CUST-001',
      effective: '01/01/2026',
    },
    {
      carrier: 'Clover Health',
      product: 'Clover Health Classic (HMO) H5145-001',
      status: 'Termed',
      policyNo: 'TEST-POL-002',
      customerNumber: 'TEST-CUST-002',
      effective: '01/01/2024',
    },
  ],
};

async function main() {
  if (process.argv.includes('--delete')) {
    const result = await prisma.client.deleteMany({
      where: { radiusRecordId: TEST_RADIUS_ID },
    });

    if (result.count > 0) {
      console.log('🗑️ Caso de prueba eliminado (cliente, caso y timeline en cascada).');
    } else {
      console.log('ℹ️ No existía el caso de prueba TEST-9999.');
    }

    return;
  }

  const fer = await prisma.user.findFirst({
    where: {
      OR: [{ shortCode: 'FER' }, { email: 'fernando@edufuture.org' }],
    },
    select: { id: true, name: true, shortCode: true },
  });

  if (!fer) {
    throw new Error(
      'No se encontró el usuario FER / fernando@edufuture.org. Verifica la base de datos antes de crear el caso de prueba.'
    );
  }

  const client = await prisma.client.upsert({
    where: { radiusRecordId: TEST_RADIUS_ID },
    update: testClientData,
    create: {
      radiusRecordId: TEST_RADIUS_ID,
      ...testClientData,
    },
  });

  // Reset idempotente: elimina casos previos del cliente de prueba (cascada de timeline).
  await prisma.aepCase.deleteMany({ where: { clientId: client.id } });

  const testCase = await prisma.aepCase.create({
    data: {
      clientId: client.id,
      category: 'NO_COMISIONABLE',
      currentCarrier: 'Aetna',
      currentPlanName: 'Aetna Medicare Prime (HMO) H5521-392',
      currentPlanId: 'H5521-392',
      policyId: 'TEST-POL-001',
      effectiveDate: '01/01/2026',
      radiusStatus: 'Active',
      eligibleHorizonCsnp: false,
      actionRequired: 'Cambiar',
      stage: 'SIN_CONTACTAR',
      assignedToId: fer.id,
    },
  });

  await prisma.timelineEvent.create({
    data: {
      caseId: testCase.id,
      userId: fer.id,
      eventType: 'NOTE',
      content: NOTE_CONTENT,
      radiusFormattedNote: `[HISTORIAL EXCEL]: ${NOTE_CONTENT}`,
    },
  });

  console.log('✅ Cliente de prueba creado/actualizado: John Doe Prueba (TEST-9999)');
  console.log(`✅ Caso creado: ${testCase.id}`);
  console.log(`   Categoría: NO_COMISIONABLE · Etapa: SIN_CONTACTAR · Asignado a: ${fer.shortCode}`);
  console.log(`   Nota: "${NOTE_CONTENT}"`);
  console.log(`🔗 http://localhost:3000/cases/${testCase.id}`);
  console.log('   Eliminar cuando termines: node create-test-case.mjs --delete');
}

main()
  .catch((error) => {
    console.error('❌ Error creando el caso de prueba:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
