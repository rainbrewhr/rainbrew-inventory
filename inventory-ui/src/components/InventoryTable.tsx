import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, MapPin, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import type { InventoryItem, SortKey, SortState } from '../types';
import { cn } from '../lib/cn';
import { fmtQty, fmtRelative } from '../lib/format';
import { StatusBadge, StockMeter } from './StatusBadge';

export interface InventoryViewProps {
  items: InventoryItem[];
  selectedIds: ReadonlySet<string>;
  activeId: string | null;
  onToggle: (id: string) => void;
  onOpen: (item: InventoryItem) => void;
  onAdjust: (item: InventoryItem) => void;
}

interface TableProps extends InventoryViewProps {
  sort: SortState;
  onSort: (key: SortKey) => void;
  onToggleAll: (checked: boolean) => void;
}

function Check({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate && !checked; }, [indeterminate, checked]);
  return (
    <input
      ref={ref} type="checkbox" checked={checked} aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className="h-4 w-4 cursor-pointer rounded-sm border-slate-300 text-slate-900 accent-slate-900 dark:border-slate-600 dark:accent-slate-100"
    />
  );
}

function SortHead({ label, k, sort, onSort, className, align = 'left' }: { label: ReactNode; k: SortKey; sort: SortState; onSort: (k: SortKey) => void; className?: string; align?: 'left' | 'right' }) {
  const on = sort.key === k;
  const Icon = !on ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn('sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-3 py-0 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400', align === 'right' && 'text-right', className)}>
      <button onClick={() => onSort(k)} className={cn('inline-flex h-10 items-center gap-1.5 whitespace-nowrap uppercase tracking-wider hover:text-slate-900 dark:hover:text-slate-100', align === 'right' && 'flex-row-reverse', on && 'text-slate-900 dark:text-slate-100')}>
        {label}<Icon className={cn('h-3 w-3', !on && 'opacity-40')} aria-hidden />
      </button>
    </th>
  );
}

const PLAIN_TH = 'sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400';

/**
 * Tablet + desktop data grid. Sticky header, sortable columns, selection.
 * Columns progressively reveal: md (core) → lg (+SKU, reorder point) → xl (+category, updated).
 */
export function InventoryTable({ items, selectedIds, activeId, sort, onSort, onToggle, onToggleAll, onOpen, onAdjust }: TableProps) {
  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));
  const someSelected = items.some((i) => selectedIds.has(i.id));
  return (
    <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          <th scope="col" className={cn(PLAIN_TH, 'w-10 pl-4')}>
            <Check checked={allSelected} indeterminate={someSelected} onChange={onToggleAll} label="Select all visible items" />
          </th>
          <SortHead label="Item" k="name" sort={sort} onSort={onSort} />
          <SortHead label="SKU" k="sku" sort={sort} onSort={onSort} className="hidden lg:table-cell" />
          <SortHead label="Location" k="location" sort={sort} onSort={onSort} className="hidden md:table-cell" />
          <SortHead label="On hand" k="onHand" sort={sort} onSort={onSort} align="right" />
          <th scope="col" className={cn(PLAIN_TH, 'hidden w-28 lg:table-cell')}>Level</th>
          <SortHead label="Status" k="status" sort={sort} onSort={onSort} />
          <SortHead label="Updated" k="updatedAt" sort={sort} onSort={onSort} className="hidden xl:table-cell" />
          <th scope="col" className={cn(PLAIN_TH, 'w-24 pr-4 text-right')}><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const selected = selectedIds.has(item.id);
          const active = activeId === item.id;
          return (
            <tr
              key={item.id}
              tabIndex={0}
              aria-selected={selected}
              onClick={() => onOpen(item)}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(item); }}
              className={cn(
                'group cursor-pointer bg-white transition-colors motion-reduce:transition-none dark:bg-slate-950',
                'hover:bg-slate-50 dark:hover:bg-slate-900',
                selected && 'bg-slate-50 dark:bg-slate-900',
                active && 'bg-slate-100 shadow-[inset_3px_0_0_0] shadow-slate-900 dark:bg-slate-900 dark:shadow-slate-100',
              )}
            >
              <td className="w-10 border-b border-slate-100 pl-4 dark:border-slate-800/80"><Check checked={selected} onChange={() => onToggle(item.id)} label={`Select ${item.name}`} /></td>
              <td className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800/80">
                <div className="font-medium leading-tight text-slate-900 dark:text-slate-100">{item.name}</div>
                <div className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 xl:hidden">
                  <span className="lg:hidden">{item.sku}</span><span className="hidden lg:inline">{item.category}</span>
                </div>
                <div className="mt-0.5 hidden text-[11px] text-slate-500 dark:text-slate-400 xl:block">{item.category}</div>
              </td>
              <td className="hidden border-b border-slate-100 px-3 font-mono text-xs text-slate-600 dark:border-slate-800/80 dark:text-slate-300 lg:table-cell">{item.sku}</td>
              <td className="hidden border-b border-slate-100 px-3 text-slate-600 dark:border-slate-800/80 dark:text-slate-300 md:table-cell"><span className="inline-flex items-center gap-1.5 whitespace-nowrap"><MapPin className="h-3 w-3 text-slate-400" aria-hidden />{item.location}</span></td>
              <td className="whitespace-nowrap border-b border-slate-100 px-3 text-right dark:border-slate-800/80">
                <span className="font-mono text-[15px] font-medium tabular-nums">{fmtQty(item.onHand)}</span>
                <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">{item.unit}</span>
              </td>
              <td className="hidden w-28 border-b border-slate-100 px-3 dark:border-slate-800/80 lg:table-cell"><StockMeter item={item} /></td>
              <td className="border-b border-slate-100 px-3 dark:border-slate-800/80"><StatusBadge item={item} /></td>
              <td className="hidden whitespace-nowrap border-b border-slate-100 px-3 text-xs text-slate-500 dark:border-slate-800/80 dark:text-slate-400 xl:table-cell">{fmtRelative(item.updatedAt)}</td>
              <td className="border-b border-slate-100 pr-3 text-right dark:border-slate-800/80">
                <div className="flex items-center justify-end gap-0.5">
                  <button onClick={(e) => { e.stopPropagation(); onAdjust(item); }} className="icon-btn" aria-label={`Adjust stock for ${item.name}`} title="Adjust stock"><SlidersHorizontal className="h-4 w-4" /></button>
                  <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 dark:text-slate-600" aria-hidden />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
