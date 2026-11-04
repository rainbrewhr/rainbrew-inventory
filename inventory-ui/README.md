# Inventory UI — "Executive Command"

A presentation-only React + Tailwind + Lucide component set. It never calls your API: everything goes through the
`InventoryAdapter` interface in `src/types.ts`, and `src/data/mockAdapter.ts` is an in-memory stand-in.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

## Connected to Supabase
`src/main.tsx` signs people in (same email and password as the Rainbrew apps) and runs the UI on `src/data/supabaseAdapter.ts`.
Everything is read and written as the signed-in user, so row-level security decides what each role can do.

| UI | Supabase |
|---|---|
| Item list | `catalog()` (items + live stock), `suppliers`, latest `stock_movements` per item (active items only) |
| Audit history | `stock_movements` for the item, with the running balance worked back from `item_stock` |
| Adjust / batch adjust | `adjust_stock(p_item_ids, p_delta, p_reason, p_note)` — posts ADJUST movements under one `ADJ-MMDD-n` reference; refuses to go below zero (migration `supabase/migrations/006_adjust_stock.sql`) |
| User chip + sign out | `profiles` (name, role); accounts that are pending or disabled see a notice instead of the app |

Notes
- Only **Admin** and **Stock Keeper** may adjust stock; other roles can browse but the adjustment is rejected with a clear message.
- The database has no SKU codes, so the SKU column shows a short stable code derived from the item id (`RB-0F7E06`).
- Reorder and critical levels that are not set yet are treated as "no alert"; zero stock is always shown as critical / out of stock.
- Config: `src/lib/supabase.ts` (URL + publishable key, safe to commit). Override with `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `VITE_USE_MOCK=true npm run dev` runs the in-memory mock instead.

## Using a different backend
Implement the three calls of `InventoryAdapter` (`src/types.ts`) and pass it in: `<App adapter={api} onNewItem={openCreateItem} />`.

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
