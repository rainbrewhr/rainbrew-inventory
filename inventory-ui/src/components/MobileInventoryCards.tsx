import { ChevronRight, MapPin, SlidersHorizontal } from 'lucide-react';
import { cn } from '../lib/cn';
import { fmtQty } from '../lib/format';
import type { InventoryViewProps } from './InventoryTable';
import { StatusBadge, StockMeter } from './StatusBadge';

/** Phone layout (< md): one card per item with the key metrics and 44px thumb-sized actions. */
export function MobileInventoryCards({ items, selectedIds, activeId, onToggle, onOpen, onAdjust }: InventoryViewProps) {
  return (
    <ul className="space-y-2.5 p-3">
      {items.map((item) => {
        const selected = selectedIds.has(item.id);
        return (
          <li key={item.id} className={cn('overflow-hidden rounded-md border bg-white shadow-panel dark:bg-slate-900', selected || activeId === item.id ? 'border-slate-900 dark:border-slate-100' : 'border-slate-200 dark:border-slate-800')}>
            <div className="flex items-start gap-1 p-3 pb-2">
              <label className="-ml-2 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center" aria-label={`Select ${item.name}`}>
                <input type="checkbox" checked={selected} onChange={() => onToggle(item.id)} className="h-[18px] w-[18px] rounded-sm accent-slate-900 dark:accent-slate-100" />
              </label>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold leading-snug">{item.name}</h3>
                <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">{item.sku}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-xl font-semibold leading-none tabular-nums">{fmtQty(item.onHand)}</div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{item.unit}</div>
              </div>
            </div>
            <div className="space-y-2 px-3 pb-3">
              <div className="flex items-center justify-between gap-2">
                <StatusBadge item={item} />
                <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"><MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden /><span className="truncate">{item.location}</span></span>
              </div>
              <StockMeter item={item} />
            </div>
            <div className="grid grid-cols-2 border-t border-slate-200 dark:border-slate-800">
              <button onClick={() => onAdjust(item)} className="flex h-11 items-center justify-center gap-2 border-r border-slate-200 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"><SlidersHorizontal className="h-4 w-4" aria-hidden />Adjust</button>
              <button onClick={() => onOpen(item)} className="flex h-11 items-center justify-center gap-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800">Details<ChevronRight className="h-4 w-4" aria-hidden /></button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
