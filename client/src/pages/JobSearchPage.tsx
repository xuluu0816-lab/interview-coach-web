import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Calendar, ExternalLink, Bookmark } from 'lucide-react';

export default function JobSearchPage() {
  const [query, setQuery] = useState('产品经理');
  const [jobType, setJobType] = useState('');
  const [city, setCity] = useState('');
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (jobType) params.set('job_type', jobType);
      if (city) params.set('city', city);
      const res = await fetch(`/api/jobs?${params}`);
      setJobs(await res.json());
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (jobId: string) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/jobs/${jobId}/save`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">岗位搜索</h1>
        <p className="text-gray-500 mt-1">互联网产品岗 · 校招/实习</p>
      </div>

      {/* 搜索栏 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="岗位关键词"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="max-w-[200px]"
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={jobType}
              onChange={e => setJobType(e.target.value)}
            >
              <option value="">全部类型</option>
              <option value="campus">校招</option>
              <option value="internship">实习</option>
              <option value="fulltime">社招</option>
            </select>
            <Input
              placeholder="城市"
              value={city}
              onChange={e => setCity(e.target.value)}
              className="max-w-[120px]"
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="w-4 h-4 mr-1" />
              {loading ? '搜索中...' : '搜索'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 结果 */}
      <div className="space-y-4">
        {searched && jobs.length === 0 && !loading && (
          <div className="text-center py-16 text-gray-400">
            <Search className="w-10 h-10 mx-auto mb-3" />
            <p>暂无岗位数据</p>
            <p className="text-xs mt-1">岗位搜索功能将在第三阶段完善，当前返回数据库中已录入的岗位</p>
          </div>
        )}

        {jobs.map(job => (
          <Card key={job.id}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">{job.company}</h3>
                    {job.job_type && <Badge variant="secondary" className="text-xs">{job.job_type === 'campus' ? '校招' : job.job_type === 'internship' ? '实习' : '社招'}</Badge>}
                  </div>
                  <p className="text-gray-700 mb-2">{job.position}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    {job.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.city}</span>}
                    {job.salary && <span>{job.salary}</span>}
                    {job.deadline && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />截止：{job.deadline}</span>}
                  </div>
                  {job.description && (
                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">{job.description.slice(0, 200)}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  {job.source_url && (
                    <a href={job.source_url} target="_blank" className="text-blue-500 hover:text-blue-700">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => handleSave(job.id)}>
                    <Bookmark className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
