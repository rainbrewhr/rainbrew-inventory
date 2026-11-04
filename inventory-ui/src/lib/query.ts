import type { FilterKey, InventoryItem, SortState } from '../types';
import { getStatus, STATUS_RANK } from './status';

export function filterItems(items: InventoryItem[], search: string, filter: FilterKey): InventoryItem[] {
  const term = search.trim().toLowerCase();
  return items.filter((item) => {
    if (filter !== 'all' && getStatus(item) !== filter) return false;
    if (!term) return true;
    return [item.name, item.sku, item.location, item.category].some((v) => v.toLowerCase().includes(term));
  });
}

export function sortItems(items: InventoryItem[], sort: SortState): InventoryItem[] {
  const dir = sort.dir === 'asc' ? 1 : -1;
  const value = (i: InventoryItem): string | number => {
    switch (sort.key) {
      case 'status':
        return STATUS_RANK[getStatus(i)];
      case 'onHand':
        return i.onHand;
      case 'updatedAt':
        return new Date(i.updatedAt).getTime();
      default:
        return i[sort.key].toLowerCase();
    }
  };
  return [...items].sort((a, b) => {
    const x = value(a), y = value(b);
    if (x < y) return -1 * dir;
    if (x > y) return 1 * dir;
    return a.name.localeCompare(b.name);
  });
}

export function countByStatus(items: InventoryItem[]): Record<FilterKey, number> {
  const out: Record<FilterKey, number> = { all: items.length, optimal: 0, low: 0, critical: 0 };
  items.forEach((i) => { out[getStatus(i)] += 1; });
  return out;
}
