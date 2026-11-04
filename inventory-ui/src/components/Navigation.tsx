import { BarChart3, Boxes, ClipboardCheck, LayoutDashboard, LogOut, Settings, ShoppingCart, ArrowLeftRight, X, type LucideIcon } from 'lucide-react';
import { useRef } from 'react';
import { cn } from '../lib/cn';
import { useOverlay } from '../hooks/useOverlay';

export interface NavEntry { id: string; label: string; icon: LucideIcon; badge?: string }

export const NAV: NavEntry[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight },
  { id: 'procurement', label: 'Procurement', icon: ShoppingCart },
  { id: 'counts', label: 'Stock counts', icon: ClipboardCheck },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className={cn('flex h-14 items-center gap-2.5 border-b border-slate-200 px-4 dark:border-slate-800', compact && 'justify-center px-0')}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-900 font-mono text-[13px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900" aria-hidden>RB</span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold tracking-tight">Inventory System</span>
          <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">Executive Command</span>
        </span>
      )}
    </div>
  );
}

function NavList({ active, onSelect, compact }: { active: string; onSelect: (id: string) => void; compact?: boolean }) {
  return (
    <nav aria-label="Primary" className="flex-1 space-y-0.5 overflow-y-auto p-2">
      {NAV.map(({ id, label, icon: Icon }) => {
        const current = id === active;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            aria-current={current ? 'page' : undefined}
            title={compact ? label : undefined}
            className={cn(
              'group flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors motion-reduce:transition-none md:h-9',
              compact && 'justify-center px-0',
              current
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            {!compact && <span className="truncate">{label}</span>}
            {compact && <span className="sr-only">{label}</span>}
          </button>
        );
      })}
    </nav>
  );
}

export interface NavUser { name: string; role: string }

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';
}

function UserBlock({ compact, user, onSignOut }: { compact?: boolean; user?: NavUser; onSignOut?: () => void }) {
  const u = user ?? { name: 'M. Clemente', role: 'Administrator' };
  return (
    <div className={cn('flex items-center gap-2.5 border-t border-slate-200 p-3 dark:border-slate-800', compact && 'flex-col p-2')}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200" title={compact ? `${u.name} · ${u.role}` : undefined} aria-hidden>{initials(u.name)}</span>
      {!compact && (
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-medium">{u.name}</span>
          <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{u.role}</span>
        </span>
      )}
      {onSignOut && <button onClick={onSignOut} className="icon-btn" aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></button>}
    </div>
  );
}

/** Tablet (md): icon rail. Desktop (lg+): full sidebar. Hidden on mobile, where `MobileNav` takes over. */
export function Sidebar({ active, onSelect, user, onSignOut }: { active: string; onSelect: (id: string) => void; user?: NavUser; onSignOut?: () => void }) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex lg:hidden">
        <Brand compact /><NavList active={active} onSelect={onSelect} compact /><UserBlock compact user={user} onSignOut={onSignOut} />
      </aside>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <Brand /><NavList active={active} onSelect={onSelect} /><UserBlock user={user} onSignOut={onSignOut} />
      </aside>
    </>
  );
}

/** Mobile slide-out drawer opened from the hamburger. */
export function MobileNav({ open, onClose, active, onSelect, user, onSignOut }: { open: boolean; onClose: () => void; active: string; onSelect: (id: string) => void; user?: NavUser; onSignOut?: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useOverlay(open, onClose, closeRef);
  return (
    <div className={cn('fixed inset-0 z-50 md:hidden', !open && 'pointer-events-none')} aria-hidden={!open}>
      <div onClick={onClose} className={cn('absolute inset-0 bg-slate-950/55 transition-opacity motion-reduce:transition-none', open ? 'opacity-100' : 'opacity-0')} />
      <aside
        role="dialog" aria-modal="true" aria-label="Navigation"
        className={cn('absolute inset-y-0 left-0 flex w-[17.5rem] max-w-[85vw] flex-col bg-white shadow-float transition-transform duration-200 ease-out motion-reduce:transition-none dark:bg-slate-900', open ? 'translate-x-0' : '-translate-x-full invisible')}
      >
        <div className="relative">
          <Brand />
          <button ref={closeRef} onClick={onClose} className="icon-btn absolute right-2 top-1.5" aria-label="Close navigation"><X className="h-5 w-5" /></button>
        </div>
        <NavList active={active} onSelect={(id) => { onSelect(id); onClose(); }} />
        <UserBlock user={user} onSignOut={onSignOut} />
      </aside>
    </div>
  );
}
