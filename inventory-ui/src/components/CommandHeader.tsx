import { Menu, Moon, Plus, Search, SlidersHorizontal, Sun, X } from 'lucide-react';
import type { RefObject } from 'react';
import type { FilterKey } from '../types';
import { cn } from '../lib/cn';

interface HeaderProps {
  search: string;
  onSearch: (v: string) => void;
  searchRef: RefObject<HTMLInputElement>;
  onOpenMenu: () => void;
  onNewItem: () => void;
  onBatchAdjust: () => void;
  selectedCount: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

/** Top command bar: hamburger (mobile), global search, theme and the two primary actions. */
export function CommandHeader({ search, onSearch, searchRef, onOpenMenu, onNewItem, onBatchAdjust, selectedCount, theme, onToggleTheme }: HeaderProps) {
  return (
    <header className="shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex h-14 items-center gap-2 px-3 pt-[env(safe-area-inset-top)] sm:px-4 lg:px-6">
        <button onClick={onOpenMenu} className="icon-btn md:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
        <div className="hidden min-w-0 pr-2 lg:block">
          <h1 className="truncate text-[15px] font-semibold leading-tight tracking-tight">Inventory</h1>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">Stock room · all locations</p>
        </div>

        <div className="relative min-w-0 flex-1 lg:max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            type="search"
            inputMode="search"
            placeholder="Search items or SKU"
            aria-label="Search inventory"
            className="field pl-9 pr-9 lg:pr-12 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {search ? (
            <button onClick={() => { onSearch(''); searchRef.current?.focus(); }} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label="Clear search"><X className="h-4 w-4" /></button>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-300 px-1.5 font-mono text-[10px] text-slate-500 dark:border-slate-700 lg:block">/</kbd>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button onClick={onToggleTheme} className="icon-btn" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          <button onClick={onBatchAdjust} disabled={selectedCount === 0} className="btn-secondary hidden sm:inline-flex" title={selectedCount ? undefined : 'Select items to adjust them together'}>
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            <span className="hidden md:inline">Batch Adjust</span>
            <span className="md:hidden">Batch</span>
            {selectedCount > 0 && <span className="rounded-sm bg-slate-900 px-1.5 font-mono text-[11px] tabular-nums text-white dark:bg-slate-100 dark:text-slate-900">{selectedCount}</span>}
          </button>
          <button onClick={onNewItem} className="btn-primary" aria-label="New item">
            <Plus className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">New Item</span>
          </button>
        </div>
      </div>
    </header>
  );
}

const PILLS: Array<{ key: FilterKey; label: string; dot?: string }> = [
  { key: 'all', label: 'All items' },
  { key: 'optimal', label: 'Optimal', dot: 'bg-status-ok' },
  { key: 'low', label: 'Low stock', dot: 'bg-status-warn' },
  { key: 'critical', label: 'Critical / out', dot: 'bg-status-crit' },
];

/** Quick filter pills with live counts; scrolls horizontally on narrow screens. */
export function FilterPills({ value, counts, onChange, resultCount }: { value: FilterKey; counts: Record<FilterKey, number>; onChange: (k: FilterKey) => void; resultCount: number }) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950 sm:px-4 lg:px-6">
      <div role="group" aria-label="Filter by stock status" className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PILLS.map((p) => {
          const on = value === p.key;
          return (
            <button
              key={p.key}
              onClick={() => onChange(p.key)}
              aria-pressed={on}
              className={cn(
                'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors motion-reduce:transition-none md:h-8',
                on
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500',
              )}
            >
              {p.dot && <span className={cn('h-1.5 w-1.5 rounded-full', p.dot)} aria-hidden />}
              {p.label}
              <span className={cn('font-mono text-[11px] tabular-nums', on ? 'opacity-80' : 'text-slate-500 dark:text-slate-400')}>{counts[p.key]}</span>
            </button>
          );
        })}
      </div>
      <p className="hidden shrink-0 text-xs text-slate-500 dark:text-slate-400 sm:block" aria-live="polite"><span className="font-mono tabular-nums">{resultCount}</span> shown</p>
    </div>
  );
}
