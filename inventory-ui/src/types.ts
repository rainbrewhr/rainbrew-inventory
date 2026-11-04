/**
 * Presentation-layer contracts.
 * Map your API responses onto these shapes inside an `InventoryAdapter`; the UI never talks to the network directly.
 */

export type StockStatus = 'optimal' | 'low' | 'critical';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  location: string;
  /** Unit of measure, e.g. "pack", "kg". */
  unit: string;
  onHand: number;
  /** At or below this quantity the item is "low". */
  reorderPoint: number;
  /** At or below this quantity the item is "critical" (0 is shown as "Out of stock"). */
  criticalLevel: number;
  supplier?: string;
  /** ISO-8601 timestamp of the last stock movement. */
  updatedAt: string;
}

export type AuditKind = 'receive' | 'release' | 'adjust' | 'count' | 'waste';

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  kind: AuditKind;
  /** Signed quantity change. */
  delta: number;
  balanceAfter: number;
  reason: string;
  reference?: string;
}

export const ADJUST_REASONS = [
  'Received delivery',
  'Stock count correction',
  'Damaged / waste',
  'Returned to stock',
  'Transfer out',
  'Other',
] as const;
export type AdjustReason = (typeof ADJUST_REASONS)[number];

export interface AdjustRequest {
  itemIds: string[];
  /** Signed change applied to every listed item. */
  delta: number;
  reason: AdjustReason;
  note?: string;
}

/** The only surface the UI needs from your backend. Implement these three calls against your API. */
export interface InventoryAdapter {
  listItems(): Promise<InventoryItem[]>;
  getAuditHistory(itemId: string): Promise<AuditEntry[]>;
  /** Resolve with the updated items; reject with an Error whose message is safe to show the user. */
  adjustStock(request: AdjustRequest): Promise<InventoryItem[]>;
}

export type FilterKey = 'all' | StockStatus;
export type SortKey = 'name' | 'sku' | 'location' | 'onHand' | 'status' | 'updatedAt';
export interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}
