import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mockAdapter } from './data/mockAdapter';
import { useInventory } from './hooks/useInventory';
import { useTheme } from './hooks/useTheme';
import { cn } from './lib/cn';
import { countByStatus, filterItems, sortItems } from './lib/query';
import type { AdjustRequest, FilterKey, InventoryAdapter, InventoryItem, SortKey, SortState } from './types';
import { CommandHeader, FilterPills } from './components/CommandHeader';
import { InventoryDrawer } from './components/InventoryDrawer';
import { InventoryList } from './components/InventoryList';
import { MobileNav, Sidebar, type NavUser } from './components/Navigation';
import { SelectionBar } from './components/SelectionBar';
import { StockModal } from './components/StockModal';
import { Toast } from './components/Toast';

interface AppProps {
  /** Swap in your real API adapter; defaults to the in-memory mock. */
  adapter?: InventoryAdapter;
  /** Called when "New Item" is pressed. Wire this to your create-item flow. */
  onNewItem?: () => void;
  /** Signed-in person, shown in the sidebar. */
  user?: NavUser;
  onSignOut?: () => void;
}

export default function App({ adapter = mockAdapter, onNewItem, user, onSignOut }: AppProps) {
  const inv = useInventory(adapter);
  const { theme, toggle } = useTheme();

  const [nav, setNav] = useState('inventory');
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortState>({ key: 'status', dir: 'asc' });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [adjustIds, setAdjustIds] = useState<string[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => countByStatus(inv.items), [inv.items]);
  const visible = useMemo(() => sortItems(filterItems(inv.items, search, filter), sort), [inv.items, search, filter, sort]);

  // Keep selection limited to items that still exist after a reload.
  useEffect(() => { setSelected((prev) => new Set([...prev].filter((id) => inv.items.some((i) => i.id === id)))); }, [inv.items]);

  // "/" focuses search (desktop shortcut).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Drawer item is looked up live so balances update after an adjustment; the last one is retained for the exit animation.
  const drawerItem = inv.items.find((i) => i.id === drawerId) ?? null;
  const lastDrawerItem = useRef<InventoryItem | null>(null);
  if (drawerItem) lastDrawerItem.current = drawerItem;

  const openItem = useCallback((item: InventoryItem) => { setDrawerId(item.id); inv.loadHistory(item.id); }, [inv]);
  const closeDrawer = useCallback(() => setDrawerId(null), []);

  const onSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'onHand' || key === 'updatedAt' ? 'desc' : 'asc' }));
  const onToggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const onToggleAll = (checked: boolean) => setSelected((s) => { const n = new Set(s); visible.forEach((i) => (checked ? n.add(i.id) : n.delete(i.id))); return n; });

  // Retain the last items so the modal does not flash empty while it animates out.
  const adjustItems = adjustIds ? inv.items.filter((i) => adjustIds.includes(i.id)) : [];
  const lastAdjust = useRef<InventoryItem[]>([]);
  if (adjustItems.length) lastAdjust.current = adjustItems;
  const submitAdjust = async (req: AdjustRequest) => {
    await inv.adjust(req);
    if (drawerId && req.itemIds.includes(drawerId)) inv.loadHistory(drawerId);
    setAdjustIds(null);
    setSelected(new Set());
    setToast(req.itemIds.length === 1 ? 'Stock updated.' : `Stock updated for ${req.itemIds.length} items.`);
  };

  const hasFilters = search.trim() !== '' || filter !== 'all';

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar active={nav} onSelect={setNav} user={user} onSignOut={onSignOut} />
      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} active={nav} onSelect={setNav} user={user} onSignOut={onSignOut} />

      <div className={cn('flex min-w-0 flex-1 flex-col transition-[padding] duration-200 motion-reduce:transition-none md:pl-16 lg:pl-60', drawerItem && 'xl:pr-[420px]')}>
        <CommandHeader
          search={search} onSearch={setSearch} searchRef={searchRef}
          onOpenMenu={() => setMenuOpen(true)}
          onNewItem={onNewItem ?? (() => setToast('Wire “New Item” to your create-item flow via the onNewItem prop.'))}
          onBatchAdjust={() => setAdjustIds([...selected])}
          selectedCount={selected.size}
          theme={theme} onToggleTheme={toggle}
        />
        <FilterPills value={filter} counts={counts} onChange={setFilter} resultCount={visible.length} />

        <main id="main" className="min-h-0 flex-1 overflow-auto overscroll-contain pb-24 md:pb-20">
          <InventoryList
            items={visible} loading={inv.loading} error={inv.error} onRetry={inv.reload}
            hasFilters={hasFilters} onClearFilters={() => { setSearch(''); setFilter('all'); }}
            selectedIds={selected} activeId={drawerId} sort={sort} onSort={onSort}
            onToggle={onToggle} onToggleAll={onToggleAll} onOpen={openItem} onAdjust={(i) => setAdjustIds([i.id])}
          />
        </main>
      </div>

      <SelectionBar count={selected.size} onClear={() => setSelected(new Set())} onBatchAdjust={() => setAdjustIds([...selected])} />
      <InventoryDrawer
        item={drawerItem ?? lastDrawerItem.current} open={drawerItem !== null}
        history={inv.history} historyLoading={inv.historyLoading}
        onClose={closeDrawer} onAdjust={(i) => setAdjustIds([i.id])}
      />
      <StockModal open={adjustIds !== null} items={adjustItems.length ? adjustItems : lastAdjust.current} onClose={() => setAdjustIds(null)} onSubmit={submitAdjust} />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
