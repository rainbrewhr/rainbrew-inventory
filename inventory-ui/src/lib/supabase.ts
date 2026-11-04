import { createClient } from '@supabase/supabase-js';

/**
 * The publishable key is designed to be public: row-level security in the database decides what each signed-in role can see or change.
 * Override with VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in a .env file to point at another project.
 */
const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://mdzwvfebndnvotugtewb.supabase.co';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_EiSLmA-JK3SybAApkK3w4Q_xd4TFk64';

export const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
