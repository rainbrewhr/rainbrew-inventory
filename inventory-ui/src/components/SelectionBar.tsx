import { SlidersHorizontal, X } from 'lucide-react';

/** Floating bar shown while items are selected; the only way to batch-adjust on phones. */
export function SelectionBar({ count, onClear, onBatchAdjust }: { count: number; onClear: () => void; onBatchAdjust: () => void }) {
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-3 md:left-16 lg:left-60">
      <div role="region" aria-label="Selection" className="pointer-events-auto flex w-full max-w-lg items-center gap-2 rounded-md bg-slate-900 p-1.5 pl-3 text-white shadow-float dark:bg-slate-100 dark:text-slate-900">
        <span className="text-sm"><span className="font-mono font-semibold tabular-nums">{count}</span> selected</span>
        <button onClick={onClear} className="ml-auto flex h-11 items-center gap-1.5 rounded px-3 text-sm hover:bg-white/10 dark:hover:bg-black/10 md:h-9"><X className="h-4 w-4" aria-hidden />Clear</button>
        <button onClick={onBatchAdjust} className="flex h-11 items-center gap-2 rounded bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-100 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800 md:h-9"><SlidersHorizontal className="h-4 w-4" aria-hidden />Batch Adjust</button>
      </div>
    </div>
  );
}
