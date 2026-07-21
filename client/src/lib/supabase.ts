/**
 * Supabase 客户端初始化
 *
 * 从 Vite 环境变量读取配置，未配置时返回 null（自动降级 localStorage）。
 * VITE_SUPABASE_URL      — Supabase 项目 URL（如 https://xxxxx.supabase.co）
 * VITE_SUPABASE_ANON_KEY — Supabase 匿名公钥（anon public key）
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let _checked = false;

function getClient(): SupabaseClient | null {
  if (_checked) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (url && key) {
    client = createClient(url, key);
  }

  _checked = true;
  return client;
}

/** 是否已配置 Supabase */
export function isSupabaseReady(): boolean {
  return getClient() !== null;
}

/** 获取 Supabase 客户端（未配置则返回 null） */
export function supabase(): SupabaseClient | null {
  return getClient();
}
