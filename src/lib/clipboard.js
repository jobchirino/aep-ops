// src/lib/clipboard.js

/**
 * Copia texto al portapapeles con fallback para navegadores que bloquean
 * la API moderna. Devuelve true si se copió correctamente.
 */
export async function copyTextToClipboard(text) {
  const value = String(text ?? '');

  if (!value) {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Si el navegador bloquea la API, se intenta el fallback clásico.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}
