import { useEffect, type RefObject } from 'react';

/** Shared behaviour for drawers/modals: close on Escape, lock page scroll, move focus in and restore it on close. */
export function useOverlay(open: boolean, onClose: () => void, focusRef: RefObject<HTMLElement>, lockScroll = true): void {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => focusRef.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
      previous?.focus?.();
    };
  }, [open, onClose, focusRef, lockScroll]);
}
