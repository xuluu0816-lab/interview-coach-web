import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { KanbanBoard } from '@/components/tracking/KanbanBoard';
import { AppTimeline } from '@/components/tracking/AppTimeline';
import { getApplications, createApplicationV2, updateApplication, deleteApplication } from '@/lib/api';
import { stageLabel, stageColor, cn } from '@/lib/utils';
import type { ApplicationV2, ApplicationStage, StageInfo } from '@/types';
import { APP_STAGES } from '@/types';
import { Plus, LayoutGrid, Clock } from 'lucide-react';

export default function TrackingPage() {
  const [apps, setApps] = useState<ApplicationV2[]>([]);
  const [view, setView] = useState<'kanban' | 'timeline'>('kanban');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ApplicationV2 | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ApplicationV2 | null>(null);
  const [form, setForm] = useState({ company: '', position: '', city: '', url: '', notes: '' });
  const [filter, setFilter] = useState<string>('');

  const load = useCallback(async () => { try { setApps(await getApplications()); } catch {} }, []);
  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.company || !form.position) return;
    if (editing) { await updateApplication(editing.id, form as any); } else { await createApplicationV2(form); }
    setDialogOpen(false); setEditing(null); setForm({ company: '', position: '', city: '', url: '', notes: '' }); load();
  };

  const handleMove = async (appId: string, to: ApplicationStage) => {
    const app = apps.find(a => a.id === appId); if (!app) return;
    const stages = [...(app.stages || [])];
    const idx = APP_STAGES.indexOf(to);
    // 标记之前所有阶段为已通过
    for (let i = 0; i < idx; i++) {
      const existing = stages.find(s => s.stage === APP_STAGES[i]);
      if (!existing || existing.status !== 'passed') {
        if (existing) { existing.status = 'passed'; existing.timestamp = existing.timestamp || new Date().toISOString(); }
        else stages.push({ stage: APP_STAGES[i], status: 'passed', timestamp: new Date().toISOString() });
      }
    }
    // 标记当前阶段
    const current = stages.find(s => s.stage === to);
    if (current) { current.status = 'current'; current.timestamp = new Date().toISOString(); }
    else stages.push({ stage: to, status: 'current', timestamp: new Date().toISOString() });
    // 跳过之前未经过的阶段
    for (let i = idx + 1; i < APP_STAGES.length; i++) {
      if (!stages.find(s => s.stage === APP_STAGES[i])) stages.push({ stage: APP_STAGES[i], status: 'pending' });
    }
    await updateApplication(appId, { currentStage: to, stages } as any);
    load();
  };

  const handleEdit = (app: ApplicationV2) => { setEditing(app); setForm({ company: app.company, position: app.position, city: app.city || '', url: app.url || '', notes: app.notes || '' }); setDialogOpen(true); };
  const handleDelete = async (id: string) => { if (!confirm('确定删除？')) return; await deleteApplication(id); load(); };
  const handleDetail = (app: ApplicationV2) => { setSelectedApp(app); setDetailOpen(true); };

  const filtered = filter ? apps.filter(a => a.currentStage === filter) : apps;

  return (
    <div className="max-w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">投递追踪</h1>
          <p className="text-sm text-gray-500 mt-1">{apps.length} 个岗位 · 6个阶段追踪</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-md p-0.5">
            <Button variant={view === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setView('kanban')}><LayoutGrid className="w-4 h-4 mr-1" />看板</Button>
            <Button variant={view === 'timeline' ? 'default' : 'ghost'} size="sm" onClick={() => setView('timeline')}><Clock className="w-4 h-4 mr-1" />时间线</Button>
          </div>
          <Button onClick={() => { setEditing(null); setForm({ company: '', position: '', city: '', url: '', notes: '' }); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />录入投递
          </Button>
        </div>
      </div>

      {/* 阶段筛选 */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant={filter === '' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setFilter('')}>全部</Badge>
        {APP_STAGES.map(s => (
          <Badge key={s} variant={filter === s ? 'default' : 'outline'} className={cn('cursor-pointer', stageColor(s))} onClick={() => setFilter(s === filter ? '' : s)}>
            {stageLabel(s)} ({apps.filter(a => a.currentStage === s).length})
          </Badge>
        ))}
      </div>

      {/* 看板视图 */}
      {view === 'kanban' && (
        <KanbanBoard applications={filtered} onMove={handleMove} onEdit={handleEdit} onDelete={handleDelete} onAdd={() => { setEditing(null); setForm({ company: '', position: '', city: '', url: '', notes: '' }); setDialogOpen(true); }} />
      )}

      {/* 时间线视图 */}
      {view === 'timeline' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(app => (
            <Card key={app.id} className="cursor-pointer hover:shadow-md" onClick={() => handleDetail(app)}>
              <CardContent className="p-4">
                <h3 className="font-semibold">{app.company}</h3>
                <p className="text-sm text-gray-500">{app.position}</p>
                <div className="mt-3"><AppTimeline app={app} /></div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-gray-400 col-span-full text-center py-12">暂无投递记录</p>}
        </div>
      )}

      {/* 录入/编辑弹窗 */}
      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditing(null); }} title={editing ? '编辑投递' : '录入投递'}>
        <div className="space-y-3">
          <Input placeholder="公司名称 *" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
          <Input placeholder="岗位名称 *" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
          <Input placeholder="城市" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
          <Input placeholder="投递链接" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
          <Input placeholder="备注" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <Button className="w-full" onClick={handleSave}>保存</Button>
        </div>
      </Dialog>

      {/* 详情弹窗 */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} title={selectedApp ? `${selectedApp.company} - ${selectedApp.position}` : ''}>
        {selectedApp && <AppTimeline app={selectedApp} />}
      </Dialog>
    </div>
  );
}
