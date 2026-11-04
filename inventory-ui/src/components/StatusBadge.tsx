import type { InventoryItem } from '../types';
import { cn } from '../lib/cn';
import { getStatus, STATUS_STYLES, statusLabel } from '../lib/status';

type Level = Pick<InventoryItem, 'onHand' | 'reorderPoint' | 'criticalLevel'>;

export function StatusBadge({ item, className }: { item: Level; className?: string }) {
  const s = STATUS_STYLES[getStatus(item)];
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium ring-1 ring-inset', s.badge, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} aria-hidden />
      {statusLabel(item)}
    </span>
  );
}

/** Thin gauge: filled up to 2× the reorder point so "healthy" reads as mostly full. */
export function StockMeter({ item, className }: { item: Level; className?: string }) {
  // Without a reorder point there is nothing to measure against.
  if (item.reorderPoint <= 0) return <div className={cn('h-1.5 w-full rounded-full border border-dashed border-slate-300 dark:border-slate-700', className)} role="img" aria-label="Reorder level not set" title="Reorder level not set" />;
  const s = STATUS_STYLES[getStatus(item)];
  const full = Math.max(item.reorderPoint * 2, 1);
  const pct = Math.max(0, Math.min(100, (item.onHand / full) * 100));
  const reorderPct = Math.min(100, (item.reorderPoint / full) * 100);
  return (
    <div className={cn('relative h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800', className)} role="img" aria-label={`${Math.round(pct)}% of target stock`}>
      <div className={cn('h-full rounded-full transition-[width] motion-reduce:transition-none', s.bar)} style={{ width: `${pct}%` }} />
      <span className="absolute top-[-2px] h-[10px] w-px bg-slate-500/70 dark:bg-slate-400/70" style={{ left: `${reorderPct}%` }} aria-hidden />
    </div>
  );
}
