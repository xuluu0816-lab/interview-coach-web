/**
 * 岗位数据拉取模块 — 双层兜底策略
 * ───────────────────────────────────────────
 * 目标数据源是企业内部受限飞书多维表格（需登录 Cookie 才能访问），
 * 浏览器端 CORS 代理几乎必定 403，因此：
 *
 *   第一层：多免费 CORS 代理并行竞速（仅作备用，成功率极低）
 *   第二层：请求仓库静态文件 /interview-coach-web/job-list.json
 *           （由 GitHub Actions + Puppeteer + Cookie 定时抓取生成）
 *   最终兜底：localStorage 持久缓存
 *
 * 所有链路失败时读取本地缓存，页面展示红色提示：
 *   「加载失败: Request failed (显示缓存数据)」
 */
import type { ExternalJob } from '@/types';

// ── 第一层：免费 CORS 代理网关列表 ──
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://thingproxy.freeboard.io/fetch/',
];

// 目标数据源（飞书多维表格短链 → 重定向到 feishu.cn 受限页面）
const TARGET_URL = 'https://su121.top/dgvcX';

// ── 第二层：仓库静态 JSON 文件路径 ──
// GitHub Actions 每 6 小时用 Puppeteer+Cookie 抓取飞书多维表格写入此文件
// 使用 Vite 内置 BASE_URL，dev 模式下为 /，生产构建时为 /interview-coach-web/
const STATIC_JSON_PATH = `${import.meta.env.BASE_URL}job-list.json`;

// ── localStorage 键名 ──
const CACHE_KEY = 'job_board_cache';

// 缓存有效期（毫秒）
const CACHE_TTL = 60 * 60 * 1000; // 1 小时

// ── 类型 ──
export interface JobBoardCache {
  data: ExternalJob[];
  timestamp: number;
  source: 'proxy' | 'static' | 'cache';
}

export interface FetchJobsResult {
  jobs: ExternalJob[];
  source: JobBoardCache['source'];
  error?: string;
}

// ═══════════════════════════════════════════
//  缓存读写
// ═══════════════════════════════════════════

function readCache(): JobBoardCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JobBoardCache;
    if (!parsed.data || !Array.isArray(parsed.data)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data: ExternalJob[], source: JobBoardCache['source']): void {
  const cache: JobBoardCache = { data, timestamp: Date.now(), source };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    localStorage.removeItem(CACHE_KEY);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* 满 */ }
  }
}

// ═══════════════════════════════════════════
//  数据规范化
// ═══════════════════════════════════════════

function normalizeJob(raw: Record<string, unknown>, index: number): ExternalJob {
  const company  = String(raw.company  || raw.公司 || raw.company_name || raw.企业 || raw['企业名称'] || '');
  const position = String(raw.position || raw.岗位 || raw.title || raw.job_title || raw.职位 || raw['岗位名称'] || '');
  const city     = String(raw.city     || raw.城市 || raw.location || raw.工作地点 || raw['工作城市'] || '');
  const rawType  = String(raw.jobType  || raw.job_type || raw.type || raw.类型 || raw.招聘类型 || 'campus').toLowerCase();

  const jobType: ExternalJob['jobType'] =
    rawType.includes('intern') || rawType.includes('实习') ? 'internship'
    : rawType.includes('fulltime') || rawType.includes('社招') || rawType.includes('全职') ? 'fulltime'
    : 'campus';

  return {
    id:           String(raw.id || raw.job_id || raw['岗位ID'] || raw._id || `job_${index}_${Date.now()}`),
    company,
    position,
    city,
    jobType,
    salary:       String(raw.salary || raw.薪资 || raw.salary_range || ''),
    description:  String(raw.description || raw.描述 || raw.desc || raw.职位描述 || ''),
    requirements: String(raw.requirements || raw.要求 || raw.requirement || raw.任职要求 || ''),
    deadline:     String(raw.deadline || raw.截止日期 || raw.end_date || raw.due_date || ''),
    link:         String(raw.link || raw.链接 || raw.url || raw.apply_url || ''),
    postedAt:     String(raw.postedAt || raw.posted_at || raw.publish_date || raw.发布时间 || raw.created_at || ''),
    source:       'su121',
    isSaved:      false,
  };
}

function extractJobArray(payload: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];

  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;

    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    if (obj.data && typeof obj.data === 'object') {
      const inner = obj.data as Record<string, unknown>;
      if (Array.isArray(inner.items))   return inner.items as Record<string, unknown>[];
      if (Array.isArray(inner.list))    return inner.list as Record<string, unknown>[];
      if (Array.isArray(inner.records)) return inner.records as Record<string, unknown>[];
    }

    if (Array.isArray(obj.items))   return obj.items as Record<string, unknown>[];
    if (Array.isArray(obj.list))    return obj.list as Record<string, unknown>[];
    if (Array.isArray(obj.records)) return obj.records as Record<string, unknown>[];

    if (obj.code === 0 || obj.code === '0' || obj.code === 200) {
      if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    }

    if (obj.success && Array.isArray(obj.result)) return obj.result as Record<string, unknown>[];
  }

  return null;
}

// ═══════════════════════════════════════════
//  第一层：CORS 代理拉取（备用，成功率极低）
// ═══════════════════════════════════════════

async function fetchViaProxy(proxy: string, url: string, signal: AbortSignal): Promise<ExternalJob[]> {
  const proxyUrl = proxy + encodeURIComponent(url);
  const res = await fetch(proxyUrl, { signal });
  if (!res.ok) throw new Error(`代理返回 ${res.status}`);

  const text = await res.text();
  if (!text || text.trim().length < 5) throw new Error('代理返回空数据');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) parsed = JSON.parse(m[0]);
    else throw new Error('无法解析返回数据');
  }

  const items = extractJobArray(parsed);
  if (!items || items.length === 0) throw new Error('未提取到岗位数据');
  return items.map((raw, i) => normalizeJob(raw, i));
}

async function tryAllProxies(): Promise<ExternalJob[] | null> {
  const controller = new AbortController();
  const state: { winner: ExternalJob[] | null } = { winner: null };

  const promises = CORS_PROXIES.map(async (proxy) => {
    try {
      const jobs = await fetchViaProxy(proxy, TARGET_URL, controller.signal);
      if (!state.winner && jobs.length > 0) {
        state.winner = jobs;
        controller.abort();
      }
      return jobs;
    } catch {
      return null;
    }
  });

  await Promise.allSettled(promises);
  return state.winner;
}

// ═══════════════════════════════════════════
//  第二层：仓库静态 JSON 拉取（核心兜底）
// ═══════════════════════════════════════════

async function fetchStaticJson(): Promise<ExternalJob[]> {
  const res = await fetch(STATIC_JSON_PATH, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`拉取静态JSON返回 ${res.status}`);
  const payload = await res.json();
  const items = extractJobArray(payload);
  if (!items || items.length === 0) throw new Error('静态JSON文件为空');
  return items.map((raw, i) => normalizeJob(raw, i));
}

// ═══════════════════════════════════════════
//  公开 API
// ═══════════════════════════════════════════

/**
 * 主入口：双层兜底拉取岗位数据
 *
 *  ① 第一层 — CORS 代理竞速（备用，飞书鉴权下几乎必定失败）
 *  ② 第二层 — 静态 JSON 文件（GitHub Actions 定时抓取）
 *  ③ 最终兜底 — localStorage 过期缓存
 */
export async function fetchJobsFromExternal(): Promise<FetchJobsResult> {
  // ── 第一层：CORS 代理 ──
  try {
    const proxyJobs = await tryAllProxies();
    if (proxyJobs && proxyJobs.length > 0) {
      writeCache(proxyJobs, 'proxy');
      return { jobs: proxyJobs, source: 'proxy' };
    }
  } catch { /* 代理全部失败，进入第二层 */ }

  // ── 第二层：仓库静态 JSON ──
  try {
    const staticJobs = await fetchStaticJson();
    if (staticJobs.length > 0) {
      writeCache(staticJobs, 'static');
      return { jobs: staticJobs, source: 'static' };
    }
  } catch { /* 静态文件不可用，进入最终兜底 */ }

  // ── 最终兜底：localStorage 缓存 ──
  const cache = readCache();
  if (cache && cache.data.length > 0) {
    const age = Date.now() - cache.timestamp;
    return {
      jobs: cache.data,
      source: 'cache',
      error: `加载失败: Request failed（显示缓存数据${age > CACHE_TTL ? `，${Math.floor(age / 60000)}分钟前` : ''}）`,
    };
  }

  throw new Error('所有数据源均不可用：代理失败、静态JSON缺失、无本地缓存');
}

/**
 * 同步读取 localStorage 缓存（页面初始化快速展示）
 */
export function getCachedJobs(): { jobs: ExternalJob[]; timestamp: number } | null {
  const cache = readCache();
  if (!cache || !cache.data.length) return null;
  return { jobs: cache.data, timestamp: cache.timestamp };
}
