import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { fetchExternalJobs, saveJob, unsaveJob } from '@/lib/api';
import { jobTypeLabel, timeAgo, cn } from '@/lib/utils';
import type { ExternalJob } from '@/types';
import { RefreshCw, ExternalLink, Bookmark, BookmarkCheck, MapPin } from 'lucide-react';

const CACHE_KEY = 'job_board_cache';

export default function JobBoardPage() {
  const [jobs, setJobs] = useState<ExternalJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keywordFilter, setKeywordFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const loadJobs = async (forceRefresh = false) => {
    try {
      // 尝试从缓存加载
      if (!forceRefresh) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 3600000) { // 1小时缓存
            setJobs(data); setLastUpdated(new Date(timestamp).toLocaleString('zh-CN')); setLoading(false); return;
          }
        }
      }
      setLoading(true); setError('');
      const data = await fetchExternalJobs('su121');
      setJobs(data);
      const ts = Date.now();
      setLastUpdated(new Date(ts).toLocaleString('zh-CN'));
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: ts }));
    } catch (err: any) {
      setError(err.message || '加载失败');
      // 降级：使用过期缓存
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) { const { data, timestamp } = JSON.parse(cached); setJobs(data); setLastUpdated('(过期缓存) ' + new Date(timestamp).toLocaleString('zh-CN')); }
    } finally { setLoading(false); }
  };

  useEffect(() => { loadJobs(); }, []);

  const handleSave = async (job: ExternalJob) => {
    if (savedIds.has(job.id)) { await unsaveJob(job.id); setSavedIds(prev => { const n = new Set(prev); n.delete(job.id); return n; }); }
    else { await saveJob(job.id); setSavedIds(prev => new Set(prev).add(job.id)); }
  };

  // 筛选
  const filtered = jobs.filter(j => {
    if (keywordFilter && !j.position.includes(keywordFilter) && !j.company.includes(keywordFilter)) return false;
    if (typeFilter && j.jobType !== typeFilter) return false;
    if (cityFilter && !(j.city || '').includes(cityFilter)) return false;
    return true;
  });

  // 提取筛选项
  const types = [...new Set(jobs.map(j => j.jobType).filter(Boolean))];
  const cities = [...new Set(jobs.map(j => j.city).filter(Boolean))];

  return (
    <div className="max-w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">秋招实时岗位</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? '加载中...' : `${jobs.length} 个岗位`}
            {lastUpdated && <span className="ml-2 text-xs">更新于 {lastUpdated}</span>}
          </p>
        </div>
        <Button onClick={() => loadJobs(true)} disabled={loading} variant="outline">
          <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />刷新
        </Button>
      </div>

      {/* 筛选栏 */}
      <div className="flex gap-3 flex-wrap">
        <Input placeholder="搜索公司/岗位" value={keywordFilter} onChange={e => setKeywordFilter(e.target.value)} className="max-w-[200px]" />
        <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="max-w-[120px]">
          <option value="">全部类型</option>
          {types.map(t => <option key={t} value={t}>{jobTypeLabel(t)}</option>)}
        </Select>
        <Select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="max-w-[140px]">
          <option value="">全部城市</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        {(keywordFilter || typeFilter || cityFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setKeywordFilter(''); setTypeFilter(''); setCityFilter(''); }}>清除筛选</Button>
        )}
      </div>

      {/* 错误提示 */}
      {error && !loading && <p className="text-sm text-red-500">加载失败：{error}（显示缓存数据）</p>}

      {/* 表格 */}
      {loading ? (
        <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
      ) : (
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
                <TableCell className="font-medium">{job.company}</TableCell>
                <TableCell>{job.position}</TableCell>
                <TableCell className="text-sm text-gray-500">{job.city || '-'}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{jobTypeLabel(job.jobType)}</Badge></TableCell>
                <TableCell className="text-sm">{job.salary || '-'}</TableCell>
                <TableCell className="text-sm text-gray-500">{job.deadline || '-'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {job.link && <a href={job.link} target="_blank" className="text-blue-500 hover:text-blue-700"><ExternalLink className="w-4 h-4" /></a>}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSave(job)}>
                      {savedIds.has(job.id) ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><td colSpan={7} className="p-4 text-center text-gray-400">暂无匹配岗位，试试调整筛选条件</td></TableRow>}
          </TableBody>
        </Table>
      )}

      <p className="text-xs text-gray-400 text-center">数据来源于外部API，仅供参考。岗位信息请以官方渠道为准。</p>
    </div>
  );
}
