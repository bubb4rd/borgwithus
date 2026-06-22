/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_BORG_AI_LOCAL?: string;
  readonly VITE_BORG_AI_USE_REMOTE?: string;
  readonly VITE_BORG_AI_MODEL?: string;
  readonly VITE_OLLAMA_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
