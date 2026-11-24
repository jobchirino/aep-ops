'use client';

// src/app/reportes/print-button.jsx
import { Download } from 'lucide-react';

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
    >
      <Download className="h-3.5 w-3.5" />
      Descargar PDF
    </button>
  );
}
