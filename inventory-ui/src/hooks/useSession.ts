import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';

export interface AppUser { id: string; name: string; email: string; role: string; approved: boolean; active: boolean }
export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'ready'; user: AppUser }
  | { status: 'blocked'; reason: string; email: string };

/** Tracks the Supabase auth session and loads the signed-in person's profile (name and role). */
export function useSession(client: SupabaseClient): { state: SessionState; signIn: (email: string, password: string) => Promise<string | null>; signOut: () => Promise<void> } {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  const load = useCallback(async () => {
    const { data } = await client.auth.getSession();
    const session = data.session;
    if (!session) { setState({ status: 'signed-out' }); return; }
    const { data: p, error } = await client.from('profiles').select('id,name,email,role,approved,active').eq('id', session.user.id).maybeSingle();
    if (error || !p) { setState({ status: 'blocked', reason: 'Your account profile could not be loaded.', email: session.user.email ?? '' }); return; }
    const user = p as AppUser;
    if (!user.active) setState({ status: 'blocked', reason: 'Your account is disabled. Ask an admin to re-enable it.', email: user.email });
    else if (!user.approved) setState({ status: 'blocked', reason: 'Your account is waiting for admin approval.', email: user.email });
    else setState({ status: 'ready', user });
  }, [client]);

  useEffect(() => {
    void load();
    const { data: sub } = client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') setState({ status: 'signed-out' }); });
    return () => sub.subscription.unsubscribe();
  }, [client, load]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    await load();
    return null;
  }, [client, load]);

  const signOut = useCallback(async () => { await client.auth.signOut(); setState({ status: 'signed-out' }); }, [client]);

  return { state, signIn, signOut };
}
