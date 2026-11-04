import { CheckCircle2, X } from 'lucide-react';
import { useEffect } from 'react';

export function Toast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDismiss, 3200);
    return () => window.clearTimeout(t);
  }, [message, onDismiss]);
  if (!message) return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[70] flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-md bg-slate-900 py-2.5 pl-3.5 pr-2 text-sm text-white shadow-float dark:bg-slate-100 dark:text-slate-900">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 dark:text-emerald-600" aria-hidden />
        <span>{message}</span>
        <button onClick={onDismiss} className="ml-1 flex h-8 w-8 items-center justify-center rounded hover:bg-white/10 dark:hover:bg-black/10" aria-label="Dismiss"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
