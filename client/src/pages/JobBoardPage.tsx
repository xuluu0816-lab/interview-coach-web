import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { fetchJobsFromExternal, getCachedJobs, saveJob, unsaveJob } from '@/lib/api';
import { jobTypeLabel, cn } from '@/lib/utils';
import type { ExternalJob } from '@/types';
import type { FetchJobsResult } from '@/lib/jobFetcher';
import { RefreshCw, ExternalLink, Bookmark, BookmarkCheck, Wifi, Database, FileJson } from 'lucide-react';

/** localStorage 缓存有效期：1小时 */
const CACHE_TTL = 60 * 60 * 1000;

export default function JobBoardPage() {
  const [jobs, setJobs] = useState<ExternalJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState<'proxy' | 'cache' | 'static' | null>(null);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  /**
   * 双层兜底加载逻辑：
   *   ① 第一层：CORS 代理（备用，飞书鉴权下几乎一定失败）
   *   ② 第二层：仓库静态 job-list.json
   *   ③ 最终兜底：localStorage 缓存
   */
  const loadJobs = useCallback(async (forceRefresh = false) => {
    // 非强制刷新 → 先快速展示缓存
    if (!forceRefresh) {
      const cached = getCachedJobs();
      if (cached) {
        setJobs(cached.jobs);
        setLastUpdated(new Date(cached.timestamp).toLocaleString('zh-CN'));
        setLoading(false);
        // 缓存未过期 → 不触发远程请求
        if (Date.now() - cached.timestamp < CACHE_TTL) return;
      }
    }

    setLoading(true);
    setError('');
    setErrorType(null);

    try {
      const result: FetchJobsResult = await fetchJobsFromExternal();
      setJobs(result.jobs);
      setLastUpdated(new Date().toLocaleString('zh-CN'));

      if (result.source === 'proxy') {
        // 第一层 CORS 代理成功（极少见）
        setError('');
        setErrorType(null);
      } else if (result.source === 'static') {
        // 第二层静态 JSON 成功 — 数据来自 Actions 定时抓取
        setError('');
        setErrorType(null);
      } else if (result.source === 'cache' && result.error) {
        // 前两层失败 → 缓存兜底 → 显示红色提示
        setError(result.error);
        setErrorType('cache');
      }
    } catch (err: any) {
      // 所有链路失败 → 最后一次尝试缓存
      const cached = getCachedJobs();
      if (cached) {
        setJobs(cached.jobs);
        setLastUpdated('(过期缓存) ' + new Date(cached.timestamp).toLocaleString('zh-CN'));
        setError('加载失败: Request failed（显示缓存数据）');
        setErrorType('cache');
      } else {
        setError('加载失败: Request failed — 无可用缓存，请稍后刷新');
        setErrorType('proxy');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // 页面初始化
  useEffect(() => { loadJobs(); }, [loadJobs]);

  /** 收藏切换 */
  const handleSave = (job: ExternalJob) => {
    if (savedIds.has(job.id)) {
      unsaveJob(job.id).catch(() => {});
      setSavedIds(prev => { const n = new Set(prev); n.delete(job.id); return n; });
    } else {
      saveJob(job.id).catch(() => {});
      setSavedIds(prev => new Set(prev).add(job.id));
    }
  };

  // ── 筛选 ──
  const filtered = jobs.filter(j => {
    if (keywordFilter && !j.position.includes(keywordFilter) && !j.company.includes(keywordFilter)) return false;
    if (typeFilter && j.jobType !== typeFilter) return false;
    if (cityFilter && !(j.city || '').includes(cityFilter)) return false;
    return true;
  });

  const types  = [...new Set(jobs.map(j => j.jobType).filter(Boolean))];
  const cities = [...new Set(jobs.map(j => j.city).filter(Boolean))];

  // ── 错误横幅样式 ──
  const ErrorIcon = errorType === 'static' ? FileJson : errorType === 'cache' ? Database : Wifi;
  const errorBg =
    errorType === 'cache'
      ? 'bg-red-50 border-red-200 text-red-700'
      : errorType === 'static'
        ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
        : 'bg-red-50 border-red-200 text-red-700';

  return (
    <div className="max-w-full space-y-4">
      {/* ═══ 标题栏 ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">秋招实时岗位</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading && jobs.length === 0 ? '加载中...' : `${jobs.length} 个岗位`}
            {lastUpdated && <span className="ml-2 text-xs text-gray-400">更新于 {lastUpdated}</span>}
          </p>
        </div>
        <Button onClick={() => loadJobs(true)} disabled={loading} variant="outline">
          <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
          刷新
        </Button>
      </div>

      {/* ═══ 错误/降级横幅 ═══ */}
      {error && (
        <div className={cn('border rounded-lg p-3 flex items-center gap-3 text-sm', errorBg)}>
          <ErrorIcon className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => loadJobs(true)}>
            <RefreshCw className="w-3 h-3 mr-1" />重试
          </Button>
        </div>
      )}

      {/* ═══ 筛选栏 ═══ */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="搜索公司/岗位"
          value={keywordFilter}
          onChange={e => setKeywordFilter(e.target.value)}
          className="max-w-[200px]"
        />
        <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="max-w-[120px]">
          <option value="">全部类型</option>
          {types.map(t => <option key={t} value={t}>{jobTypeLabel(t)}</option>)}
        </Select>
        <Select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="max-w-[140px]">
          <option value="">全部城市</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        {(keywordFilter || typeFilter || cityFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setKeywordFilter(''); setTypeFilter(''); setCityFilter(''); }}>
            清除筛选
          </Button>
        )}
        <span className="text-xs text-gray-400 self-center ml-auto">
          {filtered.length} / {jobs.length} 条
        </span>
      </div>

      {/* ═══ 岗位表格 ═══ */}
      {loading && jobs.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>公司</TableHead>
                <TableHead>岗位</TableHead>
                <TableHead>城市</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>薪资</TableHead>
                <TableHead>截止日期</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(job => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.company || '-'}</TableCell>
                  <TableCell>{job.position || '-'}</TableCell>
                  <TableCell className="text-sm text-gray-500">{job.city || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{jobTypeLabel(job.jobType)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{job.salary || '-'}</TableCell>
                  <TableCell className="text-sm text-gray-500">{job.deadline || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {job.link && (
                        <a href={job.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSave(job)}>
                        {savedIds.has(job.id)
                          ? <BookmarkCheck className="w-4 h-4 text-primary" />
                          : <Bookmark className="w-4 h-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="p-8 text-center text-gray-400">
                    {jobs.length === 0
                      ? '暂无岗位数据，请点击右上角「刷新」拉取'
                      : '暂无匹配岗位，试试调整筛选条件'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ═══ 底部说明 ═══ */}
      <p className="text-xs text-gray-400 text-center">
        数据来源于飞书多维表格，由 GitHub Actions 每 6 小时自动抓取更新。
        岗位信息请以官方渠道为准。
      </p>
    </div>
  );
}
