'use client';

// src/components/ui/progress.jsx
import { forwardRef } from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

const Progress = forwardRef(function Progress(
  { className, indicatorClassName, value, ...props },
  ref
) {
  const boundedValue = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={boundedValue}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800',
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn('h-full w-full flex-1 bg-emerald-500 transition-all', indicatorClassName)}
        style={{ transform: `translateX(-${100 - boundedValue}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});

export { Progress };
