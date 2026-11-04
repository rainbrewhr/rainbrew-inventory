import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdjustRequest, AuditEntry, AuditKind, InventoryAdapter, InventoryItem } from '../types';

/** Row shape returned by the `catalog()` function (the `item_stock` view). */
interface CatalogRow {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  stocked_at: string[] | null;
  supplier_id: string | null;
  reorder_point: number | null;
  critical_level: number | null;
  par_target: number | null;
  current_stock: number | string;
}

interface MovementRow {
  id: number;
  ts: string;
  type: string;
  signed_qty: number | string;
  reference: string | null;
  station: string | null;
  supplier: string | null;
  user_name: string | null;
  note: string | null;
}

const num = (v: number | string | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));

/** The database has no SKU codes (items are identified by name), so show a short, stable code derived from the id. */
export const skuFromId = (id: string): string => `RB-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;

function auditKind(m: MovementRow): AuditKind {
  switch (m.type) {
    case 'RECEIVE': return 'receive';
    case 'RELEASE': return 'release';
    case 'WASTE': return 'waste';
    case 'OPENING': return 'count';
    default: return m.reference?.startsWith('CNT') ? 'count' : 'adjust';
  }
}

function auditReason(m: MovementRow): string {
  if (m.type === 'RELEASE') return m.station ? `Released to ${m.station}` : 'Released';
  if (m.type === 'RECEIVE') return m.supplier ? `Received from ${m.supplier}` : 'Delivery received';
  return m.note || (m.type === 'OPENING' ? 'Opening balance' : 'Adjustment');
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** Maps the Rainbrew Supabase schema onto the presentation contracts. All access goes through RLS as the signed-in user. */
export function createSupabaseAdapter(client: SupabaseClient): InventoryAdapter {
  return {
    async listItems() {
      const [catalog, suppliers, moves] = await Promise.all([
        client.rpc('catalog'),
        client.from('suppliers').select('id,name'),
        // Latest movement per item. Not every role may read movements; if denied we simply omit "updated".
        client.from('stock_movements').select('item_id,ts').order('ts', { ascending: false }).limit(5000),
      ]);
      fail(catalog.error);
      const supplierName = new Map<string, string>((suppliers.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
      const lastMove = new Map<string, string>();
      (moves.data ?? []).forEach((m: { item_id: string; ts: string }) => { if (!lastMove.has(m.item_id)) lastMove.set(m.item_id, m.ts); });

      return (catalog.data as (CatalogRow & { active?: boolean })[])
        .filter((r) => r.active !== false)
        .map((r): InventoryItem => ({
          id: r.id,
          sku: skuFromId(r.id),
          name: r.name,
          category: r.category ?? 'Uncategorised',
          location: r.stocked_at && r.stocked_at.length ? r.stocked_at.join(' / ') : '—',
          unit: r.unit ?? '',
          onHand: num(r.current_stock),
          // Levels that are not set yet become -1 so they never trigger an alert on their own (0 stock is always critical).
          reorderPoint: r.reorder_point ?? -1,
          criticalLevel: r.critical_level ?? -1,
          supplier: r.supplier_id ? supplierName.get(r.supplier_id) : undefined,
          updatedAt: lastMove.get(r.id) ?? new Date(0).toISOString(),
        }));
    },

    async getAuditHistory(itemId) {
      const { data, error } = await client
        .from('stock_movements')
        .select('id,ts,type,signed_qty,reference,station,supplier,user_name,note')
        .eq('item_id', itemId)
        .order('ts', { ascending: false })
        .order('id', { ascending: false })
        .limit(100);
      fail(error);
      const rows = (data ?? []) as MovementRow[];
      // Running balance: newest first, so walk backwards from the current total.
      const current = await client.from('item_stock').select('current_stock').eq('id', itemId).maybeSingle();
      let balance = current.data ? num((current.data as { current_stock: number | string }).current_stock) : rows.reduce((s, r) => s + num(r.signed_qty), 0);
      return rows.map((m): AuditEntry => {
        const entry: AuditEntry = {
          id: String(m.id),
          at: m.ts,
          actor: m.user_name ?? 'System',
          kind: auditKind(m),
          delta: num(m.signed_qty),
          balanceAfter: balance,
          reason: auditReason(m),
          reference: m.reference ?? undefined,
        };
        balance -= num(m.signed_qty);
        return entry;
      });
    },

    async adjustStock({ itemIds, delta, reason, note }: AdjustRequest) {
      const { error } = await client.rpc('adjust_stock', { p_item_ids: itemIds, p_delta: delta, p_reason: reason, p_note: note ?? null });
      fail(error);
      // Return fresh values for the affected items so the grid and drawer update immediately.
      const all = await this.listItems();
      return all.filter((i) => itemIds.includes(i.id));
    },
  };
}
