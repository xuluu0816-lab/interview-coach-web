// 旧版投递页面 — 保留兼容，功能已被 TrackingPage 替代
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getApplications, createApplicationV2, updateApplication, deleteApplication } from '@/lib/api';
import { stageLabel, stageColor, formatDate } from '@/lib/utils';
import type { ApplicationV2 } from '@/types';
import { APP_STAGES } from '@/types';
import { Plus, Trash2, Edit3, MapPin, Calendar } from 'lucide-react';

export default function ApplicationsPage() {
  const [apps, setApps] = useState<ApplicationV2[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ApplicationV2 | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [form, setForm] = useState({ company: '', position: '', city: '', url: '', notes: '' });

  const load = useCallback(async () => { try { setApps(await getApplications()); } catch {} }, []);
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.company || !form.position) return;
    if (editing) { await updateApplication(editing.id, form as any); } else { await createApplicationV2(form); }
    setShowForm(false); setEditing(null); setForm({ company: '', position: '', city: '', url: '', notes: '' }); load();
  };

  const handleDelete = async (id: string) => { if (!confirm('确定删除？')) return; await deleteApplication(id); load(); };

  const filtered = filter ? apps.filter(a => a.currentStage === filter) : apps;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">投递记录（旧版）</h1><p className="text-gray-500 text-sm">新版请前往 <a href="/track" className="text-blue-500 underline">投递追踪</a></p></div><Button onClick={() => { setEditing(null); setForm({ company: '', position: '', city: '', url: '', notes: '' }); setShowForm(true); }}><Plus className="w-4 h-4 mr-1" />添加</Button></div>

      <div className="flex gap-2 flex-wrap">
        {APP_STAGES.map(s => <Badge key={s} variant={filter === s ? 'default' : 'outline'} className={`cursor-pointer ${stageColor(s)}`} onClick={() => setFilter(filter === s ? '' : s)}>{stageLabel(s)}</Badge>)}
      </div>

      {showForm && (
        <Card><CardContent className="p-4 space-y-3">
          <Input placeholder="公司名称 *" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
          <Input placeholder="岗位名称 *" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
          <Input placeholder="城市" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
          <Input placeholder="投递链接" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
          <Input placeholder="备注" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-2"><Button onClick={handleSubmit}>保存</Button><Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>取消</Button></div>
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {filtered.map(app => (
          <Card key={app.id}><CardContent className="p-4 flex items-start justify-between">
            <div><h3 className="font-semibold">{app.company} · <span className="text-sm text-gray-500">{app.position}</span></h3>
              <div className="flex gap-3 text-xs text-gray-400 mt-1">{app.city && <span><MapPin className="w-3 h-3 inline" /> {app.city}</span>}{app.url && <a href={app.url} target="_blank" className="text-blue-500">链接</a>}</div></div>
            <div className="flex items-center gap-2">
              <Badge className={stageColor(app.currentStage)}>{stageLabel(app.currentStage)}</Badge>
              <Button variant="ghost" size="icon" onClick={() => { setEditing(app); setForm({ company: app.company, position: app.position, city: app.city || '', url: app.url || '', notes: app.notes || '' }); setShowForm(true); }}><Edit3 className="w-3 h-3" /></Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(app.id)}><Trash2 className="w-3 h-3 text-red-400" /></Button>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
