/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_KEY: string;
  readonly VITE_BRAVE_API_KEY: string;
  readonly VITE_DEEPSEEK_API_KEY: string;
  readonly VITE_GLADIA_API_KEY: string;
  readonly VITE_NANGO_PUBLIC_KEY: string;
  readonly VITE_NANGO_SECRET_KEY: string;
  readonly VITE_GOOGLE_CALENDAR_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 