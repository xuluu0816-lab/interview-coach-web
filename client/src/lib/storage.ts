/**
 * 投递追踪持久化模块 — Supabase + localStorage 双层降级
 *
 * - 已配置 VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY → Supabase 数据库
 * - 未配置任一环境变量 → 自动降级 localStorage
 *
 * createApp 内置同公司查重：同公司（去空格、忽略大小写）自动合并到已有记录，
 * 阶段取较大值，前置阶段全部打勾，新字段覆盖旧字段。
 * 所有方法返回 Promise<ApplicationV2[]>，接口调用方式基本不变。
 */
import type { ApplicationV2, ApplicationStage, StageInfo } from '@/types';
import { APP_STAGES } from '@/types';
import { supabase, isSupabaseReady } from './supabase';

// ═══════════════════════════════════════════
//  localStorage 降级层
// ═══════════════════════════════════════════

const STORAGE_KEY = 'tracking_applications';

function loadLocal(): ApplicationV2[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ApplicationV2[];
  } catch {
    return [];
  }
}

function saveLocal(apps: ApplicationV2[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
  } catch {
    const trimmed = apps.slice(-30);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch { /* 彻底失败 */ }
  }
}

// ═══════════════════════════════════════════
//  Supabase 行 ↔ ApplicationV2 映射
// ═══════════════════════════════════════════

interface AppRow {
  id: string;
  company: string;
  position: string;
  city: string | null;
  current_stage: string;
  stages: any;
  applied_at: string | null;
  url: string | null;
  notes: string | null;
  updated_at: string;
}

function toRow(app: ApplicationV2): AppRow {
  return {
    id: app.id,
    company: app.company,
    position: app.position,
    city: app.city || null,
    current_stage: app.currentStage,
    stages: app.stages,
    applied_at: app.appliedAt || null,
    url: app.url || null,
    notes: app.notes || null,
    updated_at: app.updatedAt,
  };
}

function fromRow(row: AppRow): ApplicationV2 {
  let stages: StageInfo[];
  if (typeof row.stages === 'string') {
    try { stages = JSON.parse(row.stages); } catch { stages = []; }
  } else if (Array.isArray(row.stages)) {
    stages = row.stages as StageInfo[];
  } else {
    stages = [];
  }

  return {
    id: row.id,
    company: row.company,
    position: row.position,
    city: row.city || undefined,
    currentStage: (row.current_stage as ApplicationStage) || 'resume_submitted',
    stages,
    appliedAt: row.applied_at || undefined,
    url: row.url || undefined,
    notes: row.notes || undefined,
    updatedAt: row.updated_at,
  };
}

// ═══════════════════════════════════════════
//  工具
// ═══════════════════════════════════════════

function normalizeCompany(name: string): string {
  return name.trim().toLowerCase();
}

function stageIndex(stage: ApplicationStage): number {
  return APP_STAGES.indexOf(stage);
}

// ═══════════════════════════════════════════
//  CRUD（Supabase 主，localStorage 降级）
// ═══════════════════════════════════════════

/** 加载全部投递记录 */
export async function loadApplications(): Promise<ApplicationV2[]> {
  if (!isSupabaseReady()) return loadLocal();

  const client = supabase()!;
  const { data, error } = await client
    .from('applications')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('Supabase loadApplications 失败，降级 localStorage:', error.message);
    return loadLocal();
  }

  return (data as AppRow[] || []).map(fromRow);
}

/** 保存全量（仅 localStorage 降级使用） */
function saveAll(apps: ApplicationV2[]): void {
  saveLocal(apps);
}

/**
 * 创建投递记录（内置同公司查重合并）
 *
 * 查重规则：公司名称去空格、忽略大小写
 * - 无重复 → 正常新建
 * - 有重复 → 合并更新原有记录：
 *     1. currentStage 取新旧阶段中较大的
 *     2. 0 ~ 新 currentStage 的全部 stage 设为 passed
 *     3. appliedAt、notes 有值则覆盖，无值保留原有
 *     4. 更新 updatedAt
 */
export async function createApp(app: ApplicationV2): Promise<ApplicationV2[]> {
  if (!isSupabaseReady()) {
    // ── localStorage 降级 ──
    const apps = loadLocal();
    const existingIdx = apps.findIndex(a => normalizeCompany(a.company) === normalizeCompany(app.company));
    if (existingIdx === -1) {
      apps.unshift(app);
      saveLocal(apps);
      return apps;
    }
    const merged = mergeApps(apps[existingIdx], app);
    apps[existingIdx] = merged;
    saveLocal(apps);
    return apps;
  }

  // ── Supabase 路径 ──
  const client = supabase()!;
  const normalizedNew = normalizeCompany(app.company);

  // 查重：从 Supabase 模糊匹配（加载全部后在内存中比对）
  const { data: all, error: loadErr } = await client
    .from('applications')
    .select('*');

  if (loadErr) {
    console.warn('Supabase createApp 查询失败，降级 localStorage:', loadErr.message);
    return fallbackCreate(app);
  }

  const rows = (all as AppRow[]) || [];
  const existingIdx = rows.findIndex(r => normalizeCompany(r.company) === normalizedNew);

  if (existingIdx === -1) {
    // 无重复 → INSERT
    const { error: insertErr } = await client
      .from('applications')
      .insert(toRow(app));

    if (insertErr) {
      console.warn('Supabase insert 失败，降级 localStorage:', insertErr.message);
      return fallbackCreate(app);
    }

    // 重新加载返回
    const { data: reloaded } = await client
      .from('applications')
      .select('*')
      .order('updated_at', { ascending: false });
    return (reloaded as AppRow[] || []).map(fromRow);
  }

  // 有重复 → UPDATE
  const existing = fromRow(rows[existingIdx]);
  const merged = mergeApps(existing, app);
  const row = toRow(merged);

  const { error: updateErr } = await client
    .from('applications')
    .update(row)
    .eq('id', existing.id);

  if (updateErr) {
    console.warn('Supabase update 失败，降级 localStorage:', updateErr.message);
    return fallbackCreate(app);
  }

  const { data: reloaded } = await client
    .from('applications')
    .select('*')
    .order('updated_at', { ascending: false });
  return (reloaded as AppRow[] || []).map(fromRow);
}

/** localStorage 降级创建（保留原同步逻辑） */
function fallbackCreate(app: ApplicationV2): ApplicationV2[] {
  const apps = loadLocal();
  const existingIdx = apps.findIndex(a => normalizeCompany(a.company) === normalizeCompany(app.company));
  if (existingIdx === -1) {
    apps.unshift(app);
  } else {
    apps[existingIdx] = mergeApps(apps[existingIdx], app);
  }
  saveLocal(apps);
  return apps;
}

/** 更新已有记录 */
export async function updateApp(id: string, data: Partial<ApplicationV2>): Promise<ApplicationV2[]> {
  if (!isSupabaseReady()) {
    const apps = loadLocal();
    const idx = apps.findIndex(a => a.id === id);
    if (idx === -1) return apps;
    apps[idx] = { ...apps[idx], ...data, updatedAt: new Date().toISOString() } as ApplicationV2;
    saveLocal(apps);
    return apps;
  }

  const client = supabase()!;
  const row: Record<string, any> = { updated_at: new Date().toISOString() };
  if (data.company !== undefined) row.company = data.company;
  if (data.position !== undefined) row.position = data.position;
  if (data.city !== undefined) row.city = data.city || null;
  if (data.currentStage !== undefined) row.current_stage = data.currentStage;
  if (data.stages !== undefined) row.stages = data.stages;
  if (data.appliedAt !== undefined) row.applied_at = data.appliedAt || null;
  if (data.url !== undefined) row.url = data.url || null;
  if (data.notes !== undefined) row.notes = data.notes || null;

  const { error } = await client.from('applications').update(row).eq('id', id);

  if (error) {
    console.warn('Supabase updateApp 失败，降级 localStorage:', error.message);
    const apps = loadLocal();
    const idx = apps.findIndex(a => a.id === id);
    if (idx === -1) return apps;
    apps[idx] = { ...apps[idx], ...data, updatedAt: new Date().toISOString() } as ApplicationV2;
    saveLocal(apps);
    return apps;
  }

  const { data: reloaded } = await client
    .from('applications')
    .select('*')
    .order('updated_at', { ascending: false });
  return (reloaded as AppRow[] || []).map(fromRow);
}

/** 删除记录 */
export async function removeApp(id: string): Promise<ApplicationV2[]> {
  if (!isSupabaseReady()) {
    const apps = loadLocal().filter(a => a.id !== id);
    saveLocal(apps);
    return apps;
  }

  const client = supabase()!;
  const { error } = await client.from('applications').delete().eq('id', id);

  if (error) {
    console.warn('Supabase removeApp 失败，降级 localStorage:', error.message);
    const apps = loadLocal().filter(a => a.id !== id);
    saveLocal(apps);
    return apps;
  }

  const { data: reloaded } = await client
    .from('applications')
    .select('*')
    .order('updated_at', { ascending: false });
  return (reloaded as AppRow[] || []).map(fromRow);
}

// ═══════════════════════════════════════════
//  业务逻辑：同公司合并（Supabase/localStorage 共用）
// ═══════════════════════════════════════════

/**
 * 将新提交数据合并到已有记录
 * - 阶段取较大值
 * - 0 ~ targetStageIdx 全部 passed
 * - 字段有值覆盖，无值保留
 */
function mergeApps(existing: ApplicationV2, incoming: ApplicationV2): ApplicationV2 {
  const now = new Date().toISOString();

  const existingIdx = stageIndex(existing.currentStage);
  const newIdx = stageIndex(incoming.currentStage);
  const targetIdx = Math.max(existingIdx, newIdx);
  const targetStage = APP_STAGES[targetIdx];

  const oldStages = existing.stages || [];
  const newStages = incoming.stages || [];

  const mergedStages: StageInfo[] = APP_STAGES.map((stage, i) => {
    const oldInfo = oldStages.find(s => s.stage === stage);
    const newInfo = newStages.find(s => s.stage === stage);

    if (i < targetIdx) {
      return {
        stage,
        status: 'passed' as const,
        timestamp: oldInfo?.timestamp || newInfo?.timestamp || now,
      };
    } else if (i === targetIdx) {
      return {
        stage,
        status: 'current' as const,
        timestamp: newInfo?.timestamp || oldInfo?.timestamp || now,
      };
    } else {
      if (oldInfo) return oldInfo;
      return { stage, status: 'pending' as const };
    }
  });

  return {
    ...existing,
    city: incoming.city !== undefined ? incoming.city : existing.city,
    currentStage: targetStage,
    stages: mergedStages,
    appliedAt: incoming.appliedAt || existing.appliedAt,
    url: incoming.url !== undefined ? incoming.url : existing.url,
    notes: incoming.notes !== undefined ? incoming.notes : existing.notes,
    updatedAt: now,
  };
}

/** 兼容同步调用（页面初始化时的快速展示仍可用 localStorage） */
export { saveAll as saveApplications };
