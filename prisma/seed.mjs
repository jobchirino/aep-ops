import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

// Normalizador de nombres para cruce exacto entre Excel y Radius
function normalizeName(str) {
  if (!str) return '';
  return String(str)
    .toUpperCase()
    .replace(/\(.*?\)/g, '') // Quita paréntesis como (hermano de Ana Vidal)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quita tildes
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Normalizador de teléfonos para búsqueda (solo dígitos)
function digitsOnly(value) {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  return digits || null;
}

// Mapa de alias para los casos donde el nombre abreviado del Excel varía respecto a Radius
const ALIAS_MAP = {
  'CARLOS CAMPOS': 'CARLOS CAMPOS RAMOS',
  'HUGO MORA': 'HUGO MORA ESPOSO DE HEIDY SOLANO',
  'ROSA ALVARADO': 'ROSA C ALVARADO',
};

// Normalizador de códigos de plan (ej. "H0710 -004" o "H5087 | 032" -> "H0710-004")
function extractCleanPlanId(text) {
  if (!text) return null;
  const cleaned = String(text).toUpperCase().replace(/[|:]/g, '-').replace(/\s+/g, '');
  const match = cleaned.match(/([HRS]\d{4}-\d{3})/i);
  return match ? match[1].toUpperCase() : null;
}

// Extractor inteligente (Regex) de MBI, SSN y Medicaid ocultos en Policy No / Customer Number de Radius
function extractIdentifiersFromRadiusRow(row) {
  let mbi = null;
  let ssn = null;
  let medicaid = null;
  let memberId = null;
  let partA = row['part a'] ? String(row['part a']).trim() : null;
  let partB = row['part b'] ? String(row['part b']).trim() : null;

  const suffixes = ['', '.1', '.2', '.3', '.4', '.5'];
  const policies = [];

  for (const sfx of suffixes) {
    const carrier = row[`Carrier${sfx}`];
    const product = row[`Product${sfx}`];
    const status = row[`Status${sfx === '' ? '.1' : `.${parseInt(sfx.slice(1)) + 1}`}`];
    const policyNo = row[`Policy No${sfx}`];
    const custNo = row[`Customer Number${sfx}`];
    const pA = row[`part a${sfx === '' ? '.1' : sfx}`];
    const pB = row[`part b${sfx === '' ? '.1' : sfx}`];
    const eff = row[`Effective${sfx}`];

    if (!partA && pA && String(pA).includes('/')) partA = String(pA).trim();
    if (!partB && pB && String(pB).includes('/')) partB = String(pB).trim();

    if (carrier || product || policyNo || custNo) {
      policies.push({
        carrier: carrier || null,
        product: product || null,
        status: status || null,
        policyNo: policyNo || null,
        customerNumber: custNo || null,
        effective: eff || null,
      });
    }

    const combinedText = `${policyNo || ''} | ${custNo || ''}`;

    // Buscar MBI (formato Medicare 11 caracteres alfanuméricos con o sin guiones)
    if (!mbi) {
      const mbiExplicit = combinedText.match(/MBI\s*#?\*?\s*:?\s*([A-Z0-9-]{11,15})/i);
      if (mbiExplicit) {
        mbi = mbiExplicit[1].replace(/[^A-Z0-9]/gi, '').toUpperCase();
      } else {
        const mbiPattern = combinedText.match(/\b([1-9][A-Z][A-Z0-9]\d-?[A-Z][A-Z0-9]\d-?[A-Z]{2}\d{2})\b/i);
        if (mbiPattern) mbi = mbiPattern[1].replace(/-/g, '').toUpperCase();
      }
    }

    // Buscar SSN
    if (!ssn) {
      const ssnMatch = combinedText.match(/SS\s*#?\*?\s*:?\s*(\d{3}-?\d{2}-?\d{4})/i);
      if (ssnMatch) ssn = ssnMatch[1];
    }

    // Buscar Medicaid
    if (!medicaid) {
      const medMatch = combinedText.match(/Medicaid\*?\s*#?\s*:?\s*([A-Z0-9-]{6,15})/i);
      if (medMatch) medicaid = medMatch[1];
    }

    // Buscar Member ID
    if (!memberId && policyNo && !String(policyNo).toUpperCase().includes('MBI')) {
      memberId = String(policyNo).trim();
    }
  }

  return { mbi, ssn, medicaid, memberId, partA, partB, policies };
}

async function main() {
  console.log('🚀 Iniciando carga de datos AEP Medicare...');

  // 1. Crear los 4 usuarios del equipo (Contraseña inicial: medicare2026)
  const passwordHash = await bcrypt.hash('medicare2026', 10);
  const usersData = [
    { name: 'Job Chirino', shortCode: 'JOB', email: 'job@edufuture.org', role: 'AGENT' },
    { name: 'Maria', shortCode: 'MARIA', email: 'maria@edufuture.org', role: 'AGENT' },
    { name: 'Gabriela', shortCode: 'GABY', email: 'gabriela@edufuture.org', role: 'AGENT' },
    { name: 'Fernando', shortCode: 'FER', email: 'fernando@edufuture.org', role: 'AGENT' },
  ];

  // Compatibilidad con bases antiguas: convertir la fila legacy de Tatiana
  // en Fernando conservando el mismo id y sus posibles referencias.
  const legacyTatiana = await prisma.user.findFirst({
    where: { OR: [{ email: 'tatiana@edufuture.org' }, { shortCode: 'TATIANA' }] },
  });
  const existingFernando = await prisma.user.findFirst({
    where: { OR: [{ email: 'fernando@edufuture.org' }, { shortCode: 'FER' }] },
  });

  if (legacyTatiana && !existingFernando) {
    await prisma.user.update({
      where: { id: legacyTatiana.id },
      data: {
        name: 'Fernando',
        email: 'fernando@edufuture.org',
        shortCode: 'FER',
        role: 'AGENT',
      },
    });
  }

  const userMap = {};
  for (const u of usersData) {
    const created = await prisma.user.upsert({
      where: { shortCode: u.shortCode },
      update: { name: u.name, role: u.role },
      create: { ...u, passwordHash },
    });
    userMap[u.shortCode] = created;
  }

  await prisma.user.updateMany({ where: { role: 'BOSS' }, data: { role: 'AGENT' } });
  console.log('✅ Usuarios creados: Job, Maria, Gabriela y Fernando.');

  // 2. Leer y cargar los 1,447 clientes de Radius (report_26_11_02.csv)
  const csvPath = path.join(process.cwd(), 'data', 'report_26_11_02.csv');
  const csvWorkbook = XLSX.readFile(csvPath, { raw: true });
  const csvSheet = csvWorkbook.Sheets[csvWorkbook.SheetNames[0]];
  const radiusRows = XLSX.utils.sheet_to_json(csvSheet, { defval: null });

  const clientByNormName = {};
  for (const row of radiusRows) {
    const recordId = String(row['Record ID'] || '').trim();
    const rawName = String(row['Name'] || '').trim();
    if (!recordId || !rawName) continue;

    const norm = normalizeName(rawName);
    const extracted = extractIdentifiersFromRadiusRow(row);

    const client = await prisma.client.upsert({
      where: { radiusRecordId: recordId },
      update: {
        fullName: rawName,
        normalizedName: norm,
        dob: row['Date of Birth'] ? String(row['Date of Birth']) : null,
        gender: row['Gender'] ? String(row['Gender']) : null,
        phone: row['Phone'] ? String(row['Phone']) : null,
        cell: row['Cell'] ? String(row['Cell']) : null,
        phoneNormalized: digitsOnly(row['Phone']),
        cellNormalized: digitsOnly(row['Cell']),
        email: row['Email'] ? String(row['Email']) : null,
        address: row['Address'] ? String(row['Address']) : null,
        city: row['City'] ? String(row['City']) : null,
        state: row['State'] ? String(row['State']) : null,
        zip: row['Zip'] ? String(row['Zip']) : null,
        mbi: extracted.mbi,
        ssn: extracted.ssn,
        medicaidNumber: extracted.medicaid,
        memberId: extracted.memberId,
        partADate: extracted.partA,
        partBDate: extracted.partB,
        radiusUrl: row['Link To Record'] ? String(row['Link To Record']) : null,
        rawPoliciesJson: extracted.policies,
      },
      create: {
        radiusRecordId: recordId,
        masterRecordId: row['Master Record ID'] ? String(row['Master Record ID']) : null,
        fullName: rawName,
        normalizedName: norm,
        dob: row['Date of Birth'] ? String(row['Date of Birth']) : null,
        gender: row['Gender'] ? String(row['Gender']) : null,
        phone: row['Phone'] ? String(row['Phone']) : null,
        cell: row['Cell'] ? String(row['Cell']) : null,
        phoneNormalized: digitsOnly(row['Phone']),
        cellNormalized: digitsOnly(row['Cell']),
        email: row['Email'] ? String(row['Email']) : null,
        address: row['Address'] ? String(row['Address']) : null,
        city: row['City'] ? String(row['City']) : null,
        state: row['State'] ? String(row['State']) : null,
        zip: row['Zip'] ? String(row['Zip']) : null,
        mbi: extracted.mbi,
        ssn: extracted.ssn,
        medicaidNumber: extracted.medicaid,
        memberId: extracted.memberId,
        partADate: extracted.partA,
        partBDate: extracted.partB,
        radiusUrl: row['Link To Record'] ? String(row['Link To Record']) : null,
        rawPoliciesJson: extracted.policies,
      },
    });

    clientByNormName[norm] = client;
  }
  console.log(`✅ ${Object.keys(clientByNormName).length} clientes de Radius procesados con MBI/SSN/Part A-B.`);

  // Helper para resolver agente desde el texto del Excel
  function resolveAgentId(agentStr) {
    if (!agentStr) return null;
    const upper = String(agentStr).toUpperCase().trim();
    if (upper.includes('JOB')) return userMap['JOB'].id;
    if (upper.includes('MARIA')) return userMap['MARIA'].id;
    if (upper.includes('GAB')) return userMap['GABY'].id;
    if (upper.includes('FERN') || upper.includes('FER')) return userMap['FER'].id;
    return null;
  }

  // Helper para deducir etapa inicial según la nota del Excel
  function inferStageFromNote(note) {
    if (!note) return 'SIN_CONTACTAR';
    const upper = String(note).toUpperCase();
    if (upper.includes('ENVIAD')) return 'CERRADO_DOCS_ENVIADOS';
    if (upper.includes('CAMBIO CON OTRO AGENTE')) return 'DESCARTADO';
    if (upper.includes('FIRMA')) return 'ESPERANDO_FIRMA';
    if (upper.includes('COMPARANDO') || upper.includes('BUSCANDO PLAN')) return 'BUSCANDO_PLAN';
    return 'EN_SEGUIMIENTO';
  }

  // 3. Leer AEP 2027.xlsx y cargar los casos evitando duplicados
  const aepPath = path.join(process.cwd(), 'data', 'AEP 2027.xlsx');
  const aepWb = XLSX.readFile(aepPath);

  await prisma.timelineEvent.deleteMany({});
  await prisma.aepCase.deleteMany({});

  const processedClientCategory = new Set();

  async function createCaseFromExcel({ rawName, category, carrier, planName, policyId, effDate, termDate, status, horizonCsnp, action, agentName, notes }) {
    let norm = normalizeName(rawName);
    if (ALIAS_MAP[norm]) norm = ALIAS_MAP[norm];

    // Evitar duplicados en la misma categoría (como Rosa Alvarado en fila 13 y fila 37)
    const uniqueKey = `${norm}__${category}`;
    if (processedClientCategory.has(uniqueKey)) return;
    processedClientCategory.add(uniqueKey);

    let client = clientByNormName[norm];
    if (!client) {
      client = await prisma.client.create({
        data: {
          radiusRecordId: `MANUAL_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          fullName: rawName,
          normalizedName: norm,
        },
      });
      clientByNormName[norm] = client;
    }

    const assignedToId = resolveAgentId(agentName);
    const stage = inferStageFromNote(notes);

    const newCase = await prisma.aepCase.create({
      data: {
        clientId: client.id,
        category,
        currentCarrier: carrier || null,
        currentPlanName: planName || null,
        currentPlanId: extractCleanPlanId(planName),
        policyId: policyId ? String(policyId) : null,
        effectiveDate: effDate ? String(effDate) : null,
        terminationDate: termDate ? String(termDate) : null,
        radiusStatus: status || null,
        eligibleHorizonCsnp: String(horizonCsnp || '').toUpperCase() === 'YES',
        actionRequired: action || null,
        stage,
        assignedToId,
        sentByTatiana: stage === 'CERRADO_DOCS_ENVIADOS',
        docsReady: stage === 'CERRADO_DOCS_ENVIADOS',
        sentAt: stage === 'CERRADO_DOCS_ENVIADOS' ? new Date() : null,
      },
    });

    if (notes && String(notes).trim() !== '') {
      const authorId = assignedToId || userMap['JOB'].id;
      await prisma.timelineEvent.create({
        data: {
          caseId: newCase.id,
          userId: authorId,
          eventType: 'NOTE',
          content: String(notes).trim(),
          radiusFormattedNote: `[HISTORIAL EXCEL]: ${String(notes).trim()}`,
        },
      });
    }
  }

  // Hoja 1: CLIENTES CON PLANES NO RENOVABL
  const noRenRows = XLSX.utils.sheet_to_json(aepWb.Sheets['CLIENTES CON PLANES NO RENOVABL'], { defval: null });
  for (const r of noRenRows) {
    if (!r['Name']) continue;
    await createCaseFromExcel({
      rawName: r['Name'],
      category: 'NO_RENOVABLE',
      carrier: r['Plan'] ? String(r['Plan']).split(' ')[0] : null,
      planName: r['Plan'],
      policyId: r['Policy ID'],
      effDate: r['Effective Date'],
      termDate: r['Termination Date'],
      status: r['Status '],
      horizonCsnp: r['Elegible Plan C-SNP Horizon'],
      action: r['Acción'],
      agentName: r['Agente'],
      notes: r['Notas'],
    });
  }

  // Hoja 2: CLIENTES CON PLANES NO COMISION (encabezados en fila 1)
  const noComRaw = XLSX.utils.sheet_to_json(aepWb.Sheets['CLIENTES CON PLANES NO COMISION'], { header: 1, defval: null });
  for (let i = 1; i < noComRaw.length; i++) {
    const row = noComRaw[i];
    if (!row || !row[1]) continue;
    await createCaseFromExcel({
      rawName: row[1],
      category: 'NO_COMISIONABLE',
      carrier: row[0],
      planName: row[2],
      policyId: null,
      effDate: null,
      termDate: '12/31/2026',
      status: row[3],
      horizonCsnp: false,
      action: row[4],
      agentName: row[5],
      notes: row[6],
    });
  }

  // Hoja 3: CLIENTES CANCELADOS
  const cancRows = XLSX.utils.sheet_to_json(aepWb.Sheets['CLIENTES CANCELADOS'], { defval: null });
  for (const r of cancRows) {
    if (!r['Nombre']) continue;
    await createCaseFromExcel({
      rawName: r['Nombre'],
      category: 'CANCELADO',
      carrier: r['Plan Actual'] ? String(r['Plan Actual']).split(' ')[0] : null,
      planName: r['Plan Actual'],
      policyId: null,
      effDate: null,
      termDate: null,
      status: r['Status '],
      horizonCsnp: false,
      action: r['Acción'],
      agentName: r['Agente'],
      notes: null,
    });
  }

  console.log('✅ Casos de AEP 2027 importados y vinculados con Radius.');

  // 4. Importar Catálogo de Planes No Comisionables
  const plansPath = path.join(process.cwd(), 'data', '2025_2026 PLANES NO COMISIONABLES.xlsx');
  if (fs.existsSync(plansPath)) {
    await prisma.nonCommissionablePlan.deleteMany({});
    const plansWb = XLSX.readFile(plansPath);
    const recordsToInsert = [];

    for (const sheetName of plansWb.SheetNames) {
      if (!sheetName.startsWith('base_')) continue;
      const carrierName = sheetName.replace('base_', '').toUpperCase();
      const rows = XLSX.utils.sheet_to_json(plansWb.Sheets[sheetName], { defval: null });

      for (const r of rows) {
        const rawId = String(r['PLAN ID'] || '').trim();
        if (!rawId) continue;
        const cleanId = extractCleanPlanId(rawId) || rawId.toUpperCase();
        recordsToInsert.push({
          carrier: carrierName,
          year: parseInt(r['YEAR']) || 2026,
          state: String(r['STATE'] || '').trim().toUpperCase(),
          planId: cleanId,
          rawPlanId: rawId,
          planName: String(r['NAME'] || '').trim(),
          planType: r['TYPE'] ? String(r['TYPE']).trim() : null,
          serviceArea: r['SERVICES AREA'] ? String(r['SERVICES AREA']).trim() : null,
          statusNote: r['GARANTIZADO/CONFIRMADO'] ? String(r['GARANTIZADO/CONFIRMADO']).trim() : 'No Comisionable',
        });
      }
    }

    if (recordsToInsert.length > 0) {
      await prisma.nonCommissionablePlan.createMany({ data: recordsToInsert });
    }
    console.log(`✅ ${recordsToInsert.length} planes no comisionables cargados en el validador.`);
  }

  console.log('🎉 ¡Semilla completada con éxito!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });