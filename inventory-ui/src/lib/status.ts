import type { InventoryItem, StockStatus } from '../types';

export function getStatus(item: Pick<InventoryItem, 'onHand' | 'reorderPoint' | 'criticalLevel'>): StockStatus {
  // Nothing on the shelf is always critical, even when no levels have been configured for the item yet.
  if (item.onHand <= 0 || item.onHand <= item.criticalLevel) return 'critical';
  if (item.onHand <= item.reorderPoint) return 'low';
  return 'optimal';
}

export function statusLabel(item: Pick<InventoryItem, 'onHand' | 'reorderPoint' | 'criticalLevel'>): string {
  if (item.onHand <= 0) return 'Out of stock';
  return { optimal: 'Optimal', low: 'Low stock', critical: 'Critical' }[getStatus(item)];
}

/** Lower rank = needs attention first. */
export const STATUS_RANK: Record<StockStatus, number> = { critical: 0, low: 1, optimal: 2 };

export const STATUS_STYLES: Record<StockStatus, { badge: string; dot: string; bar: string; text: string }> = {
  optimal: {
    badge: 'bg-status-ok/10 text-status-ok ring-status-ok/25 dark:text-emerald-400 dark:ring-emerald-400/30',
    dot: 'bg-status-ok',
    bar: 'bg-status-ok',
    text: 'text-status-ok dark:text-emerald-400',
  },
  low: {
    badge: 'bg-status-warn/10 text-status-warn ring-status-warn/30 dark:text-amber-400 dark:ring-amber-400/30',
    dot: 'bg-status-warn',
    bar: 'bg-status-warn',
    text: 'text-status-warn dark:text-amber-400',
  },
  critical: {
    badge: 'bg-status-crit/10 text-status-crit ring-status-crit/25 dark:text-red-400 dark:ring-red-400/30',
    dot: 'bg-status-crit',
    bar: 'bg-status-crit',
    text: 'text-status-crit dark:text-red-400',
  },
};
