// src/lib/discard-reasons.js
// Resúmenes revisados para los casos descartados actuales.
// Si aparece un caso nuevo sin resumen, se usa la última nota significativa.
const DISCARD_REASON_OVERRIDES = {
  cmvztqbbv017d8y1wbhbc2v1o: 'Se cambió con otro agente.',
  cmvztqdnm018f8y1wyia61nuu:
    'Se cambió de plan con otro agente y no tiene interés en volver.',
  cmvztqfmw019b8y1wmf4y35vu:
    'Se va de Estados Unidos y no piensa regresar.',
  cmvztqhcc01a28y1w70cdhhp5:
    'No quiere cambiar de plan; ya confirmó con Humana que todo sigue igual.',
  cmvztqkym01bm8y1wufds6r9x:
    'Prefiere seguir gestionando directamente con el seguro; no quiere continuar con nosotros.',
  cmvztqlbq01bs8y1woirly4un:
    'No desea ser contactada; ya no está con nosotros desde hace tiempo.',
  cmwcev527000d8y3os57n0b4o:
    'Ya resolvió todo con otra agencia física en Nueva York.',
  cmwedi2ds0005l808c2yno02f:
    'Ya coordinó su cambio con otra oficina/agente.',
};

function isMeaningfulNote(note) {
  const text = String(note || '').trim();

  if (!text) return false;

  return !/^(caso creado|caso agregado|notas?)[\s:.-]*$/i.test(text);
}

/**
 * Devuelve un motivo corto para mostrar en el reporte.
 * Prioriza el resumen revisado y, si no existe, la última nota real.
 */
export function getDiscardReason(aepCase) {
  const override = DISCARD_REASON_OVERRIDES[aepCase?.id];

  if (override) return override;

  const notes = (aepCase?.timeline || [])
    .filter((event) => event.eventType === 'NOTE')
    .map((event) => event.content)
    .filter(isMeaningfulNote);

  const latestNote = notes[notes.length - 1];

  if (!latestNote) return null;

  return String(latestNote).replace(/\s+/g, ' ').trim().slice(0, 260);
}
