import type { AdjustRequest, AuditEntry, AuditKind, InventoryAdapter, InventoryItem } from '../types';

/**
 * In-memory stand-in for your API. Replace each method body with a fetch/SDK call that returns the same shapes.
 * Latency is simulated so loading states are visible while designing.
 */

const SEED: Array<[string, string, string, string, number, number, number]> = [
  // name, category, location, unit, onHand, reorderPoint, criticalLevel
  ['Coffee Beans 1kg', 'Beverage', 'Stock Room 1', 'pack', 8, 12, 4],
  ['Black Pearl 1kg', 'Beverage', 'Stock Room 1', 'pack', 29, 15, 5],
  ['Escaba White Beans', 'Beverage', 'Stock Room 1', 'bottle', 30, 20, 8],
  ['Escaba Red Monggo', 'Beverage', 'Stock Room 1', 'bottle', 23, 20, 8],
  ['Oat Milk 1L', 'Dairy', 'Stock Room 2', 'bottle', 0, 6, 2],
  ['Whipping Cream', 'Dairy', 'Chiller A', 'pack', 3, 8, 3],
  ['Paper Cup 12oz (Hot)', 'Packaging', 'Stock Room 1', 'pack', 69, 40, 15],
  ['Dabba Cup 16oz', 'Packaging', 'Stock Room 1', 'pack', 34, 30, 10],
  ['Dabba Lids', 'Packaging', 'Stock Room 1', 'pack', 18, 20, 8],
  ['Hinge Cup 25ml', 'Packaging', 'Stock Room 1', 'box', 172, 100, 40],
  ['Burger Box', 'Packaging', 'Stock Room 1', 'pack', 18, 20, 8],
  ['Pasta Box', 'Packaging', 'Stock Room 1', 'pack', 8, 15, 5],
  ['Aluminum Trays', 'Packaging', 'Stock Room 1', 'pcs', 37, 30, 10],
  ['Rice Meal LB-2', 'Packaging', 'Stock Room 1', 'pack', 12, 20, 8],
  ['Oyster Sauce', 'Sauces', 'Stock Room 1', 'gallon', 43, 20, 8],
  ['Ketchup', 'Sauces', 'Stock Room 1', 'gallon', 0, 4, 1],
  ['Mayonnaise', 'Sauces', 'Stock Room 1', 'gallon', 3, 6, 2],
  ['Hot Sauce', 'Sauces', 'Stock Room 1', 'gallon', 3, 4, 1],
  ['Sweet Chili Sauce 550g', 'Sauces', 'Stock Room 2', 'bottle', 2, 4, 1],
  ['Linguine 500g', 'Dry Goods', 'Stock Room 1', 'pack', 0, 10, 3],
  ['Spaghetti Pasta', 'Dry Goods', 'Stock Room 1', 'pack', 4, 10, 3],
  ['Sotanghon', 'Dry Goods', 'Stock Room 1', 'pack', 30, 15, 5],
  ['Pancit Canton', 'Dry Goods', 'Stock Room 1', 'pack', 14, 15, 5],
  ['Ramen Mild', 'Dry Goods', 'Stock Room 1', 'pack', 8, 12, 4],
  ['Fried Garlic', 'Dry Goods', 'Stock Room 1', 'pack', 2, 6, 2],
  ['Magnesol', 'Dry Goods', 'Stock Room 1', 'pack', 9, 10, 3],
  ['Chicken Breading', 'Dry Goods', 'Stock Room 1', 'sack', 6, 4, 1],
  ['Pizza Box Regular', 'Packaging', 'Stairs', 'pack', 33, 20, 8],
  ['Thermal Paper 80mm', 'Office', 'Stock Room 1', 'roll', 29, 12, 4],
  ['Ballpen Black', 'Office', 'Stock Room 1', 'pcs', 6, 10, 3],
  ['Chocolate Fudge', 'Beverage', 'Stock Room 1', 'pack', 3, 5, 2],
  ['Caramel Fudge', 'Beverage', 'Stock Room 1', 'pack', 2, 5, 2],
  ['Ice Cream Powder 1kg', 'Beverage', 'Stock Room 1', 'pack', 41, 25, 10],
  ['Muscovado', 'Dry Goods', 'Stock Room 1', 'bag', 5, 6, 2],
  ['Gloves (Box)', 'Supplies', 'Stock Room 1', 'box', 5, 6, 2],
  ['Scotch Tape', 'Supplies', 'Stock Room 1', 'pack', 15, 10, 4],
  ['Hard Straw Wrapped', 'Packaging', 'Stock Room 1', 'pack', 31, 20, 8],
  ['Boba Straw Wrapped', 'Packaging', 'Stock Room 1', 'pack', 21, 20, 8],
  ['Softdrinks Straw', 'Packaging', 'Stock Room 1', 'pack', 22, 20, 8],
  ['Yogurt Spoon Long', 'Packaging', 'Stock Room 1', 'pack', 7, 8, 3],
];

const ACTORS = ['M. Clemente', 'J. Santos', 'R. Dela Cruz', 'A. Reyes'];
const SUPPLIERS = ['CMC Trading', 'Chefs & Bakers', 'Pack N Box', 'Binalbagan Market'];
const REASONS: Record<AuditKind, string[]> = {
  receive: ['Delivery received', 'Purchase order fulfilled'],
  release: ['Released to Barista Station', 'Released to Kitchen Station', 'Released to Dining Station'],
  adjust: ['Stock count correction'],
  count: ['Weekly count'],
  waste: ['Damaged in storage'],
};

/** Deterministic pseudo-random so the mock data is stable between reloads. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const now = Date.now();
const MIN = 60_000;

function buildStore(): { items: InventoryItem[]; audit: Map<string, AuditEntry[]> } {
  const audit = new Map<string, AuditEntry[]>();
  const items = SEED.map(([name, category, location, unit, onHand, reorderPoint, criticalLevel], idx) => {
    const r = rng(idx + 11);
    const id = `itm-${String(idx + 1).padStart(3, '0')}`;
    // Build a plausible history that ends exactly at the current balance.
    const entries: AuditEntry[] = [];
    let balance = onHand;
    const count = 4 + Math.floor(r() * 5);
    for (let k = 0; k < count; k += 1) {
      const kinds: AuditKind[] = ['release', 'release', 'receive', 'adjust', 'waste', 'count'];
      const kind = kinds[Math.floor(r() * kinds.length)]!;
      const size = 1 + Math.floor(r() * Math.max(2, onHand / 4 + 3));
      const delta = kind === 'receive' ? size : kind === 'adjust' || kind === 'count' ? (r() > 0.5 ? 1 : -1) * Math.max(1, Math.floor(size / 3)) : -size;
      const reasonList = REASONS[kind];
      entries.push({
        id: `${id}-a${k}`,
        at: new Date(now - (k * 26 + 2 + Math.floor(r() * 20)) * 60 * MIN).toISOString(),
        actor: ACTORS[Math.floor(r() * ACTORS.length)]!,
        kind,
        delta,
        balanceAfter: Math.max(0, balance),
        reason: reasonList[Math.floor(r() * reasonList.length)]!,
        reference: kind === 'release' ? `REQ-${1100 + idx}-${k + 1}` : kind === 'receive' ? `RCV-${1100 + idx}-${k + 1}` : undefined,
      });
      balance -= delta;
    }
    audit.set(id, entries);
    return {
      id,
      sku: `RB-${(1000 + idx * 7).toString(36).toUpperCase()}-${String(idx + 1).padStart(3, '0')}`,
      name, category, location, unit, onHand, reorderPoint, criticalLevel,
      supplier: SUPPLIERS[idx % SUPPLIERS.length],
      updatedAt: entries[0]!.at,
    } satisfies InventoryItem;
  });
  return { items, audit };
}

const store = buildStore();
const wait = <T,>(value: T, ms = 320): Promise<T> => new Promise((res) => setTimeout(() => res(value), ms));

export const mockAdapter: InventoryAdapter = {
  listItems: () => wait(store.items.map((i) => ({ ...i }))),

  getAuditHistory: (itemId) => wait([...(store.audit.get(itemId) ?? [])]),

  async adjustStock({ itemIds, delta, reason, note }: AdjustRequest) {
    const targets = store.items.filter((i) => itemIds.includes(i.id));
    const short = targets.find((i) => i.onHand + delta < 0);
    if (short) throw new Error(`Not enough stock for ${short.name} (on hand ${short.onHand}).`);
    const stamp = new Date().toISOString();
    for (const item of targets) {
      item.onHand += delta;
      item.updatedAt = stamp;
      const list = store.audit.get(item.id) ?? [];
      list.unshift({
        id: `${item.id}-${stamp}`,
        at: stamp,
        actor: 'You',
        kind: 'adjust',
        delta,
        balanceAfter: item.onHand,
        reason: note ? `${reason} — ${note}` : reason,
      });
      store.audit.set(item.id, list);
    }
    return wait(targets.map((i) => ({ ...i })), 380);
  },
};
