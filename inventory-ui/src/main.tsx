import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthGate } from './components/AuthGate';
import { mockAdapter } from './data/mockAdapter';
import { createSupabaseAdapter } from './data/supabaseAdapter';
import { supabase } from './lib/supabase';
import './index.css';

// Module-level so the adapter identity is stable between renders.
const liveAdapter = createSupabaseAdapter(supabase);
const useMock = import.meta.env.VITE_USE_MOCK === 'true';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {useMock ? (
      <App adapter={mockAdapter} />
    ) : (
      <AuthGate client={supabase}>
        {(user, signOut) => <App adapter={liveAdapter} user={{ name: user.name, role: user.role }} onSignOut={signOut} />}
      </AuthGate>
    )}
  </StrictMode>,
);
