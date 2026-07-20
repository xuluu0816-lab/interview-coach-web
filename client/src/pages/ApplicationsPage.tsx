import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getApplications, createApplication, updateApplication, deleteApplication, getAppStats } from '@/lib/api';
import type { Application, ApplicationStatus } from '@/types';
import { appStatusLabel, appStatusColor, formatDate } from '@/lib/utils';
import { Plus, Trash2, Edit3, BarChart3, Calendar, MapPin, ExternalLink } from 'lucide-react';

const statuses: ApplicationStatus[] = ['applied', 'screening', 'written', 'interview1', 'interview2', 'hr', 'offer', 'rejected'];

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Application | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  // 表单状态
  const [form, setForm] = useState({ company: '', position: '', city: '', applied_at: '', status: 'applied', notes: '', url: '' });

  const load = useCallback(async () => {
    try { setApps(await getApplications()); } catch {}
    try { setStats(await getAppStats()); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.company || !form.position) return alert('公司名和岗位名不能为空');
    if (editing) {
      await updateApplication(editing.id, form);
    } else {
      await createApplication(form);
    }
    setShowForm(false);
    setEditing(null);
    setForm({ company: '', position: '', city: '', applied_at: '', status: 'applied', notes: '', url: '' });
    load();
  };

  const handleEdit = (app: Application) => {
    setEditing(app);
    setForm({ company: app.company, position: app.position, city: app.city || '', applied_at: app.applied_at || '', status: app.status, notes: app.notes || '', url: app.url || '' });
    setShowForm(true);
  };

  const handleStatusChange = async (app: Application, status: string) => {
    await updateApplication(app.id, { status: status as ApplicationStatus });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除？')) return;
    await deleteApplication(id);
    load();
  };

  const filtered = filter ? apps.filter(a => a.status === filter) : apps;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">投递记录</h1>
          <p className="text-gray-500 mt-1">管理你的求职进度</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ company: '', position: '', city: '', applied_at: '', status: 'applied', notes: '', url: '' }); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> 添加记录
        </Button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-5 gap-3">
          {statuses.map(s => (
            <Card key={s} className={`cursor-pointer ${filter === s ? 'ring-2 ring-primary' : ''}`} onClick={() => setFilter(filter === s ? '' : s)}>
              <CardContent className="pt-4 text-center">
                <div className={appStatusColor(s)}>
                  <span className="text-2xl font-bold">{stats.by_status?.[s] || 0}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{appStatusLabel(s)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 添加/编辑表单 */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">{editing ? '编辑记录' : '添加投递'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="公司名称 *" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
              <Input placeholder="岗位名称 *" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
              <Input placeholder="城市" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              <Input type="date" placeholder="投递日期" value={form.applied_at} onChange={e => setForm({ ...form, applied_at: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">当前进度</label>
              <div className="flex flex-wrap gap-1">
                {statuses.map(s => (
                  <Badge key={s} variant={form.status === s ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setForm({ ...form, status: s })}>
                    {appStatusLabel(s)}
                  </Badge>
                ))}
              </div>
            </div>
            <Input placeholder="投递链接" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
            <Input placeholder="备注" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            <div className="flex gap-2">
              <Button onClick={handleSubmit}>保存</Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>取消</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 投递列表 */}
      <div className="space-y-3">
        {filtered.length === 0 && <p className="text-center text-gray-400 py-12">还没有投递记录，点击上方按钮添加</p>}
        {filtered.map(app => (
          <Card key={app.id}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{app.company}</h3>
                    <span className="text-gray-300">·</span>
                    <span className="text-sm text-gray-600">{app.position}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {app.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{app.city}</span>}
                    {app.applied_at && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{app.applied_at}</span>}
                    {app.url && <a href={app.url} target="_blank" className="flex items-center gap-1 text-blue-500 hover:underline"><ExternalLink className="w-3 h-3" />链接</a>}
                  </div>
                  {app.notes && <p className="text-xs text-gray-500 mt-1">{app.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className={`text-xs rounded px-2 py-1 border ${appStatusColor(app.status)}`}
                    value={app.status}
                    onChange={e => handleStatusChange(app, e.target.value)}
                  >
                    {statuses.map(s => <option key={s} value={s}>{appStatusLabel(s)}</option>)}
                  </select>
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(app)}><Edit3 className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(app.id)}><Trash2 className="w-3 h-3 text-red-400" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
