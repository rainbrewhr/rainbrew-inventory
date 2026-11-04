import { AlertTriangle, PackageSearch, RefreshCw } from 'lucide-react';
import type { SortKey, SortState } from '../types';
import { InventoryTable, type InventoryViewProps } from './InventoryTable';
import { MobileInventoryCards } from './MobileInventoryCards';

interface Props extends InventoryViewProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClearFilters: () => void;
  hasFilters: boolean;
  sort: SortState;
  onSort: (k: SortKey) => void;
  onToggleAll: (checked: boolean) => void;
}

/** Chooses the right presentation for the viewport: stacked cards below `md`, data grid from `md` up. */
export function InventoryList(props: Props) {
  const { loading, error, items, onRetry, onClearFilters, hasFilters } = props;

  if (loading) {
    return (
      <div className="space-y-px p-3 md:p-0" aria-busy="true" aria-label="Loading inventory">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex h-16 animate-pulse items-center gap-4 bg-white px-4 motion-reduce:animate-none dark:bg-slate-950 md:h-12">
            <div className="h-4 w-4 rounded-sm bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="ml-auto h-3 w-12 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-5 w-20 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-20 text-center">
        <AlertTriangle className="h-8 w-8 text-status-crit" aria-hidden />
        <h2 className="mt-3 text-base font-semibold">Couldn’t load inventory</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <button onClick={onRetry} className="btn-secondary mt-4"><RefreshCw className="h-4 w-4" aria-hidden />Try again</button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-20 text-center">
        <PackageSearch className="h-8 w-8 text-slate-400" aria-hidden />
        <h2 className="mt-3 text-base font-semibold">No items found</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hasFilters ? 'Nothing matches your search or filter.' : 'There are no inventory items yet.'}</p>
        {hasFilters && <button onClick={onClearFilters} className="btn-secondary mt-4">Clear search and filters</button>}
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden"><MobileInventoryCards {...props} /></div>
      <div className="hidden md:block"><InventoryTable {...props} /></div>
    </>
  );
}
