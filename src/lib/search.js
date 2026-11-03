// src/lib/search.js

/**
 * Normaliza un nombre igual que Client.normalizedName:
 * mayúsculas, sin acentos, sin paréntesis ni caracteres especiales.
 */
export function normalizeSearchName(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\(.*?\)/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deja solo los dígitos de un teléfono.
 */
export function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}
