/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Set to "true" to run against the in-memory mock instead of Supabase. */
  readonly VITE_USE_MOCK?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
