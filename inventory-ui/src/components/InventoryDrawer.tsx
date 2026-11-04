import { ArrowDownRight, ArrowUpRight, ClipboardCheck, History, MapPin, PackageMinus, PackagePlus, SlidersHorizontal, Trash2, X, type LucideIcon } from 'lucide-react';
import { useRef } from 'react';
import type { AuditEntry, AuditKind, InventoryItem } from '../types';
import { cn } from '../lib/cn';
import { fmtDateTime, fmtDelta, fmtQty, fmtRelative } from '../lib/format';
import { useOverlay } from '../hooks/useOverlay';
import { StatusBadge, StockMeter } from './StatusBadge';

interface Props {
  /** Keep passing the last item while `open` flips to false so the exit animation has content. */
  item: InventoryItem | null;
  open: boolean;
  history: AuditEntry[];
  historyLoading: boolean;
  onClose: () => void;
  onAdjust: (item: InventoryItem) => void;
}

const KIND: Record<AuditKind, { label: string; icon: LucideIcon }> = {
  receive: { label: 'Received', icon: PackagePlus },
  release: { label: 'Released', icon: PackageMinus },
  adjust: { label: 'Adjustment', icon: SlidersHorizontal },
  count: { label: 'Stock count', icon: ClipboardCheck },
  waste: { label: 'Waste', icon: Trash2 },
};

function Stat({ label, value, unit, plain }: { label: string; value: string; unit?: string; plain?: boolean }) {
  return (
    <div className="bg-white px-3 py-2.5 dark:bg-slate-900">
      <dt className="label-caps">{label}</dt>
      <dd className={cn('mt-1 text-lg font-semibold tabular-nums', !plain && 'font-mono')}>{value}{unit && <span className="ml-1 font-sans text-xs font-normal text-slate-500 dark:text-slate-400">{unit}</span>}</dd>
    </div>
  );
}

/**
 * Right-hand inspector. Full screen on mobile, 420px panel from `md`.
 * From `xl` it docks beside the grid (the page reserves its width) instead of covering it.
 */
export function InventoryDrawer({ item, open, history, historyLoading, onClose, onAdjust }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useOverlay(open, onClose, closeRef, false);

  return (
    <div className={cn('fixed inset-0 z-40', !open && 'pointer-events-none')} aria-hidden={!open}>
      <div onClick={onClose} className={cn('absolute inset-0 bg-slate-950/45 transition-opacity motion-reduce:transition-none xl:hidden', open ? 'opacity-100' : 'opacity-0')} />
      <aside
        role="dialog" aria-modal="true" aria-label={item ? `${item.name} details` : 'Item details'}
        className={cn(
          'absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-float transition-transform duration-200 ease-out motion-reduce:transition-none dark:bg-slate-900 md:w-[420px] md:border-l md:border-slate-200 md:dark:border-slate-800',
          open ? 'translate-x-0' : 'invisible translate-x-full',
        )}
      >
        {item && (
          <>
            <div className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-slate-800">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{item.sku}</p>
                <h2 className="mt-0.5 text-lg font-semibold leading-tight tracking-tight">{item.name}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge item={item} /><span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><MapPin className="h-3 w-3" aria-hidden />{item.location}</span></div>
              </div>
              <button ref={closeRef} onClick={onClose} className="icon-btn -mr-1.5" aria-label="Close details"><X className="h-5 w-5" /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <dl className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-800">
                <Stat label="On hand" value={fmtQty(item.onHand)} unit={item.unit} />
                <Stat label="Reorder point" value={fmtQty(item.reorderPoint)} unit={item.unit} />
                <Stat label="Critical level" value={fmtQty(item.criticalLevel)} unit={item.unit} />
                <Stat label="Last movement" value={fmtRelative(item.updatedAt)} plain />
              </dl>

              <section className="border-b border-slate-200 px-4 py-4 dark:border-slate-800" aria-label="Stock level">
                <StockMeter item={item} />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Marker shows the reorder point. Bar is scaled to twice that level.</p>
              </section>

              <section className="border-b border-slate-200 px-4 py-4 dark:border-slate-800" aria-label="Attributes">
                <h3 className="label-caps mb-2">Attributes</h3>
                <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 text-sm">
                  <dt className="text-slate-500 dark:text-slate-400">Category</dt><dd>{item.category}</dd>
                  <dt className="text-slate-500 dark:text-slate-400">Location</dt><dd>{item.location}</dd>
                  <dt className="text-slate-500 dark:text-slate-400">Supplier</dt><dd>{item.supplier ?? '—'}</dd>
                  <dt className="text-slate-500 dark:text-slate-400">Unit</dt><dd>{item.unit}</dd>
                </dl>
              </section>

              <section className="px-4 py-4" aria-label="Audit history">
                <h3 className="label-caps mb-3 flex items-center gap-1.5"><History className="h-3.5 w-3.5" aria-hidden />Audit history</h3>
                {historyLoading ? (
                  <div className="space-y-3" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-slate-100 motion-reduce:animate-none dark:bg-slate-800" />)}</div>
                ) : history.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No movements recorded.</p>
                ) : (
                  <ol className="relative space-y-0 border-l border-slate-200 pl-5 dark:border-slate-800">
                    {history.map((h) => {
                      const k = KIND[h.kind];
                      const up = h.delta > 0;
                      return (
                        <li key={h.id} className="relative pb-4 last:pb-0">
                          <span className="absolute -left-[1.7rem] top-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"><k.icon className="h-3 w-3" aria-hidden /></span>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-medium">{k.label}</span>
                            <span className={cn('inline-flex items-center gap-0.5 font-mono text-sm font-semibold tabular-nums', up ? 'text-status-ok dark:text-emerald-400' : 'text-status-crit dark:text-red-400')}>
                              {up ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}{fmtDelta(h.delta)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">{h.reason}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {fmtDateTime(h.at)} · {h.actor}{h.reference && <> · <span className="font-mono">{h.reference}</span></>} · balance <span className="font-mono tabular-nums">{fmtQty(h.balanceAfter)}</span>
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900">
              <button onClick={() => onAdjust(item)} className="btn-primary w-full"><SlidersHorizontal className="h-4 w-4" aria-hidden />Adjust stock</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
