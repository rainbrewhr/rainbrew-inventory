import { AlertCircle, Loader2, Minus, Plus, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { ADJUST_REASONS, type AdjustReason, type AdjustRequest, type InventoryItem } from '../types';
import { cn } from '../lib/cn';
import { fmtDelta, fmtQty } from '../lib/format';
import { useOverlay } from '../hooks/useOverlay';
import { getStatus, STATUS_STYLES } from '../lib/status';

interface Props {
  open: boolean;
  /** One item for a quick adjust, several for a batch adjust (the same change is applied to each). */
  items: InventoryItem[];
  onClose: () => void;
  onSubmit: (request: AdjustRequest) => Promise<void>;
}

const QUICK = [-10, -5, -1, 1, 5, 10];

/** Bottom sheet on phones, centred dialog from `sm`. */
export function StockModal({ open, items, onClose, onSubmit }: Props) {
  const uid = useId();
  const qtyRef = useRef<HTMLInputElement>(null);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<AdjustReason | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setDelta(0); setReason(''); setNote(''); setError(null); setBusy(false); } }, [open]);
  useOverlay(open, busy ? () => undefined : onClose, qtyRef);

  const single = items.length === 1 ? items[0]! : null;
  const preview = useMemo(() => (single ? single.onHand + delta : null), [single, delta]);
  const shortItem = items.find((i) => i.onHand + delta < 0);
  const needsNote = reason === 'Other';

  const problem =
    delta === 0 ? 'Enter a quantity to add or remove.'
    : shortItem ? `${shortItem.name} only has ${fmtQty(shortItem.onHand)} on hand.`
    : !reason ? 'Choose a reason for the audit trail.'
    : needsNote && !note.trim() ? 'Add a short note when the reason is “Other”.'
    : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (problem || busy || !reason) return;
    setBusy(true); setError(null);
    try {
      await onSubmit({ itemIds: items.map((i) => i.id), delta, reason, note: note.trim() || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The adjustment could not be saved.');
      setBusy(false);
    }
  }

  const change = (n: number) => setDelta((d) => Math.round((d + n) * 1000) / 1000);

  return (
    <div className={cn('fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4', !open && 'pointer-events-none')} aria-hidden={!open}>
      <div onClick={busy ? undefined : onClose} className={cn('absolute inset-0 bg-slate-950/55 transition-opacity motion-reduce:transition-none', open ? 'opacity-100' : 'opacity-0')} />
      <form
        onSubmit={submit}
        role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`}
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col rounded-t-lg bg-white shadow-float transition-all duration-200 ease-out motion-reduce:transition-none dark:bg-slate-900 sm:max-w-md sm:rounded-md',
          open ? 'translate-y-0 opacity-100' : 'invisible translate-y-6 opacity-0',
        )}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <h2 id={`${uid}-t`} className="text-base font-semibold tracking-tight">{single ? 'Adjust stock' : `Batch adjust · ${items.length} items`}</h2>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {single ? <><span className="font-medium text-slate-700 dark:text-slate-200">{single.name}</span> · <span className="font-mono">{single.sku}</span></> : items.slice(0, 3).map((i) => i.name).join(', ') + (items.length > 3 ? ` +${items.length - 3} more` : '')}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="icon-btn -mr-1.5" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {single && (
            <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-md border border-slate-200 text-center dark:divide-slate-800 dark:border-slate-800">
              <div className="px-2 py-2"><div className="label-caps">On hand</div><div className="mt-0.5 font-mono text-base font-semibold tabular-nums">{fmtQty(single.onHand)}</div></div>
              <div className="px-2 py-2"><div className="label-caps">Change</div><div className={cn('mt-0.5 font-mono text-base font-semibold tabular-nums', delta > 0 && 'text-status-ok dark:text-emerald-400', delta < 0 && 'text-status-crit dark:text-red-400')}>{delta === 0 ? '0' : fmtDelta(delta)}</div></div>
              <div className="px-2 py-2"><div className="label-caps">New balance</div><div className={cn('mt-0.5 font-mono text-base font-semibold tabular-nums', preview !== null && preview >= 0 && STATUS_STYLES[getStatus({ ...single, onHand: preview })].text, preview !== null && preview < 0 && 'text-status-crit')}>{fmtQty(preview ?? 0)}</div></div>
            </div>
          )}

          <div>
            <label htmlFor={`${uid}-q`} className="label-caps mb-1.5 block">{single ? 'Quantity to add / remove' : 'Quantity to add / remove (each item)'}</label>
            <div className="flex items-stretch gap-2">
              <button type="button" onClick={() => change(-1)} className="btn-secondary w-12 px-0" aria-label="Decrease by 1"><Minus className="h-4 w-4" /></button>
              <input
                id={`${uid}-q`} ref={qtyRef} type="number" inputMode="decimal" step="any" value={delta === 0 ? '' : delta} placeholder="0"
                onChange={(e) => setDelta(e.target.value === '' || e.target.value === '-' ? 0 : Number(e.target.value))}
                className="field text-center font-mono text-lg font-semibold tabular-nums md:h-11"
              />
              <button type="button" onClick={() => change(1)} className="btn-secondary w-12 px-0" aria-label="Increase by 1"><Plus className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 grid grid-cols-6 gap-1.5" role="group" aria-label="Quick amounts">
              {QUICK.map((q) => (
                <button key={q} type="button" onClick={() => change(q)} className="btn-secondary h-11 px-0 font-mono text-xs tabular-nums md:h-8">{q > 0 ? `+${q}` : `−${Math.abs(q)}`}</button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor={`${uid}-r`} className="label-caps mb-1.5 block">Reason <span className="text-status-crit">*</span></label>
            <select id={`${uid}-r`} value={reason} onChange={(e) => setReason(e.target.value as AdjustReason)} className="field">
              <option value="">Select a reason…</option>
              {ADJUST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor={`${uid}-n`} className="label-caps mb-1.5 block">Note {needsNote ? <span className="text-status-crit">*</span> : <span className="font-normal normal-case tracking-normal">(optional)</span>}</label>
            <textarea id={`${uid}-n`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={240} placeholder="Reference, invoice no., or what happened" className="field h-auto min-h-[4.5rem] resize-none py-2 md:h-auto" />
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-status-crit/30 bg-status-crit/10 p-2.5 text-sm text-status-crit dark:text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>{error}</span>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-800">
          {problem && delta !== 0 && <p className="mb-2 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">{problem}</p>}
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={!!problem || busy} className="btn-primary">
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {delta === 0 ? 'Apply adjustment' : `Apply ${fmtDelta(delta)}${single ? '' : ' to each'}`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
