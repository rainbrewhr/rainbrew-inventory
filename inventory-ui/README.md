# Inventory UI — "Executive Command"

A presentation-only React + Tailwind + Lucide component set. It never calls your API: everything goes through the
`InventoryAdapter` interface in `src/types.ts`, and `src/data/mockAdapter.ts` is an in-memory stand-in.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

## Map it to your API
Implement three calls and pass them in — no other file changes:

```tsx
import App from './App';
const api: InventoryAdapter = {
  listItems:       () => fetch('/api/items').then(r => r.json()).then(rows => rows.map(toInventoryItem)),
  getAuditHistory: (id) => fetch(`/api/items/${id}/history`).then(r => r.json()).then(rows => rows.map(toAuditEntry)),
  adjustStock:     (req) => post('/api/adjustments', req),   // resolve with the updated items; throw Error(message) to show it in the modal
};
<App adapter={api} onNewItem={openCreateItem} />
```

`InventoryItem.onHand / reorderPoint / criticalLevel` drive the status badge (optimal / low / critical, and "Out of stock" at 0).

## Layout by breakpoint
| Viewport | Navigation | Inventory | Inspector |
|---|---|---|---|
| `< md` (phone) | Hamburger → slide-out drawer | Stacked cards, 44px actions, selection bar for batch | Full screen |
| `md` (tablet) | Icon rail | Grid: item, location, on hand, status | 420px panel over a dimmed grid |
| `lg` | Full 240px sidebar | + SKU, level gauge | 420px panel over a dimmed grid |
| `xl` (desktop) | Full sidebar | + category, updated | **Docks** beside the grid (grid reflows) |

## Files
- `components/CommandHeader.tsx` — search (`/` shortcut), theme toggle, **New Item** / **Batch Adjust**, `FilterPills`
- `components/Navigation.tsx` — `Sidebar` (rail + full) and `MobileNav` drawer
- `components/InventoryList.tsx` — loading / error / empty states; picks cards vs grid
- `components/InventoryTable.tsx` — sortable grid, sticky header, row selection
- `components/MobileInventoryCards.tsx` — phone card list
- `components/InventoryDrawer.tsx` — inspector with attributes and audit timeline
- `components/StockModal.tsx` — +/- adjustment with required reason (bottom sheet on phones); also used for batch
- `hooks/useInventory.ts` — adapter wrapper (load, adjust, history); `hooks/useOverlay.ts` — Esc, scroll lock, focus restore

Status colours: emerald `#059669`, amber `#D97706`, crimson `#DC2626` (`tailwind.config.ts`). Dark mode via the `dark` class, remembered per browser.
