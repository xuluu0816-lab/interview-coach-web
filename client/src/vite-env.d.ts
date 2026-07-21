/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** Supabase 项目 URL（https://xxxxx.supabase.co） */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase 匿名公钥（anon public key） */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Groq API Key — 用于语音转文字（免费额度 14,400次/天） */
  readonly VITE_GROQ_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

