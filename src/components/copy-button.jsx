'use client';

// src/components/copy-button.jsx
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyTextToClipboard } from '@/lib/clipboard';
import { cn } from '@/lib/utils';

export default function CopyButton({
  text,
  label = 'Copiar',
  copiedLabel = 'Copiado',
  className,
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const success = await copyTextToClipboard(text);

    if (success) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200',
        className
      )}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? copiedLabel : label}
    </button>
  );
}
