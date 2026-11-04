import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdjustRequest, AuditEntry, InventoryAdapter, InventoryItem } from '../types';

export interface UseInventory {
  items: InventoryItem[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  adjust: (request: AdjustRequest) => Promise<void>;
  history: AuditEntry[];
  historyLoading: boolean;
  loadHistory: (itemId: string | null) => void;
}

/** Thin data hook around an `InventoryAdapter`. Components below it stay purely presentational. */
export function useInventory(adapter: InventoryAdapter): UseInventory {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyToken = useRef(0);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    adapter.listItems().then(setItems, (e: unknown) => setError(e instanceof Error ? e.message : 'Could not load inventory.')).finally(() => setLoading(false));
  }, [adapter]);

  useEffect(reload, [reload]);

  const loadHistory = useCallback((itemId: string | null) => {
    const token = ++historyToken.current;
    if (!itemId) { setHistory([]); setHistoryLoading(false); return; }
    setHistoryLoading(true);
    adapter.getAuditHistory(itemId).then(
      (rows) => { if (token === historyToken.current) setHistory(rows); },
      () => { if (token === historyToken.current) setHistory([]); },
    ).finally(() => { if (token === historyToken.current) setHistoryLoading(false); });
  }, [adapter]);

  const adjust = useCallback(async (request: AdjustRequest) => {
    const updated = await adapter.adjustStock(request);
    setItems((prev) => prev.map((i) => updated.find((u) => u.id === i.id) ?? i));
  }, [adapter]);

  return { items, loading, error, reload, adjust, history, historyLoading, loadHistory };
}
