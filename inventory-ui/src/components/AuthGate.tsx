import type { SupabaseClient } from '@supabase/supabase-js';
import { AlertCircle, Loader2, LogOut } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useSession, type AppUser } from '../hooks/useSession';

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-900 font-mono text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" aria-hidden>RB</span>
          <div className="leading-tight"><h1 className="text-lg font-semibold tracking-tight">Inventory System</h1><p className="text-xs text-slate-500 dark:text-slate-400">Executive Command</p></div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-slate-900">{children}</div>
      </div>
    </div>
  );
}

/** Shows the sign-in form until there is an approved session, then renders the app with the signed-in user. */
export function AuthGate({ client, children }: { client: SupabaseClient; children: (user: AppUser, signOut: () => void) => ReactNode }) {
  const { state, signIn, signOut } = useSession(client);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === 'loading') {
    return <Frame><div className="flex items-center gap-2 text-sm text-slate-500" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Loading…</div></Frame>;
  }
  if (state.status === 'ready') return <>{children(state.user, () => void signOut())}</>;

  if (state.status === 'blocked') {
    return (
      <Frame>
        <h2 className="text-base font-semibold">Can’t open the inventory yet</h2>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{state.reason}</p>
        {state.email && <p className="mt-1 text-xs text-slate-500">{state.email}</p>}
        <button onClick={() => void signOut()} className="btn-secondary mt-4 w-full"><LogOut className="h-4 w-4" aria-hidden />Sign out</button>
      </Frame>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const message = await signIn(email.trim(), password);
    if (message) { setError(message); setBusy(false); }
  }

  return (
    <Frame>
      <h2 className="text-base font-semibold">Sign in</h2>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div><label htmlFor="em" className="label-caps mb-1.5 block">Email</label><input id="em" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" /></div>
        <div><label htmlFor="pw" className="label-caps mb-1.5 block">Password</label><input id="pw" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="field" /></div>
        {error && <div role="alert" className="flex items-start gap-2 rounded-md border border-status-crit/30 bg-status-crit/10 p-2.5 text-sm text-status-crit dark:text-red-400"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>{error}</span></div>}
        <button type="submit" disabled={busy} className="btn-primary w-full">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Sign in</button>
      </form>
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Use the same email and password as the Rainbrew apps. New accounts are created there and approved by an admin.</p>
    </Frame>
  );
}
