import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { KanbanBoard } from '@/components/tracking/KanbanBoard';
import { AppTimeline } from '@/components/tracking/AppTimeline';
import { loadApplications, createApp, updateApp, removeApp } from '@/lib/storage';
import { stageLabel, stageColor, cn } from '@/lib/utils';
import type { ApplicationV2, ApplicationStage, StageInfo } from '@/types';
import { APP_STAGES, STAGE_OPTIONS } from '@/types';
import { Plus, LayoutGrid, Clock, ExternalLink, Table2 } from 'lucide-react';

/** 飞书多维表格 — 实时岗位 */
const JOB_BOARD_URL = 'https://ycnynolbv7lx.feishu.cn/base/M7p6bYxFWa3GcXscQ1HcHaAWnod?table=tbl9yRzedJi2IHX3&view=vewXjLcyvq';

/** 生成唯一 ID */
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export default function TrackingPage() {
  const [apps, setApps] = useState<ApplicationV2[]>([]);
  const [view, setView] = useState<'kanban' | 'timeline'>('kanban');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ApplicationV2 | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ApplicationV2 | null>(null);
  const [form, setForm] = useState({
    company: '',
    position: '',
    city: '',
    url: '',
    notes: '',
    currentStage: 'resume_submitted' as ApplicationStage,
  });
  const [filter, setFilter] = useState<string>('');

  // ── 初始化：从 Supabase / localStorage 加载 ──
  useEffect(() => {
    loadApplications().then(setApps);
  }, []);

  // ── 保存（新建 / 编辑） ──
  const handleSave = async () => {
    if (!form.company.trim() || !form.position.trim()) return;
    const now = new Date().toISOString();

    if (editing) {
      // ═══ 编辑已有记录 ═══
      const oldStages = editing.stages || [];
      const selectedIdx = APP_STAGES.indexOf(form.currentStage);

      // 构建新的 stages 数组
      const newStages: StageInfo[] = APP_STAGES.map((stage, i) => {
        const existing = oldStages.find(s => s.stage === stage);

        if (i < selectedIdx) {
          // 选中阶段之前：
          //   - 之前已通过的 → 保持 passed
          //   - 之前是 current 的 → 变为 passed
          //   - 从未录入过的 → 保持空白（无 status，不显示勾）
          if (existing && (existing.status === 'passed' || existing.status === 'current')) {
            return { ...existing, status: 'passed' as const, timestamp: existing.timestamp || now };
          }
          // 从未到达过 → 仅保留占位，无 status
          return { stage, status: 'pending' as const };
        } else if (i === selectedIdx) {
          // 当前选中阶段 → current
          return { stage, status: 'current' as const, timestamp: now };
        } else {
          // 选中阶段之后 → 保持原状或 pending
          if (existing) return existing;
          return { stage, status: 'pending' as const };
        }
      });

      const updated = await updateApp(editing.id, {
        company: form.company,
        position: form.position,
        city: form.city || undefined,
        url: form.url || undefined,
        notes: form.notes || undefined,
        currentStage: form.currentStage,
        stages: newStages,
        appliedAt: editing.appliedAt,
      });
      setApps(updated);
    } else {
      // ═══ 新建记录 ═══
      // 规则：生成完整 7 步时间线，选中阶段及前置全部打勾
      const selectedIdx = APP_STAGES.indexOf(form.currentStage);

      const stages: StageInfo[] = APP_STAGES.map((stage, i) => {
        if (i < selectedIdx) {
          // 前置阶段 → passed（打勾）
          return { stage, status: 'passed' as const, timestamp: now };
        } else if (i === selectedIdx) {
          // 当前阶段 → current
          return { stage, status: 'current' as const, timestamp: now };
        } else {
          // 后续阶段 → pending
          return { stage, status: 'pending' as const };
        }
      });

      const newApp: ApplicationV2 = {
        id: uid(),
        company: form.company,
        position: form.position,
        city: form.city || undefined,
        currentStage: form.currentStage,
        stages,
        appliedAt: now.slice(0, 10),
        url: form.url || undefined,
        notes: form.notes || undefined,
        updatedAt: now,
      };

      const updated = await createApp(newApp);
      setApps(updated);
    }

    // 重置表单
    setDialogOpen(false);
    setEditing(null);
    setForm({ company: '', position: '', city: '', url: '', notes: '', currentStage: 'resume_submitted' });
  };

  // ── 看板拖拽移动阶段 ──
  const handleMove = async (appId: string, to: ApplicationStage) => {
    const app = apps.find(a => a.id === appId);
    if (!app) return;
    const now = new Date().toISOString();
    const toIdx = APP_STAGES.indexOf(to);
    const oldStages = app.stages || [];

    const newStages: StageInfo[] = APP_STAGES.map((stage, i) => {
      const existing = oldStages.find(s => s.stage === stage);

      if (i < toIdx) {
        // 之前已通过/当前的 → passed；从未到达过的 → 保留 pending（空白）
        if (existing && (existing.status === 'passed' || existing.status === 'current')) {
          return { ...existing, status: 'passed' as const, timestamp: existing.timestamp || now };
        }
        return { stage, status: 'pending' as const };
      } else if (i === toIdx) {
        return { stage, status: 'current' as const, timestamp: now };
      } else {
        if (existing) return existing;
        return { stage, status: 'pending' as const };
      }
    });

    const updated = await updateApp(appId, { currentStage: to, stages: newStages });
    setApps(updated);
  };

  // ── 编辑 / 删除 / 详情 ──
  const handleEdit = (app: ApplicationV2) => {
    setEditing(app);
    setForm({
      company: app.company,
      position: app.position,
      city: app.city || '',
      url: app.url || '',
      notes: app.notes || '',
      currentStage: app.currentStage,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这条投递记录？')) return;
    const updated = await removeApp(id);
    setApps(updated);
  };

  const handleDetail = (app: ApplicationV2) => {
    setSelectedApp(app);
    setDetailOpen(true);
  };

  // ── 筛选 ──
  const filtered = filter ? apps.filter(a => a.currentStage === filter) : apps;

  return (
    <div className="max-w-full space-y-4">
      {/* ═══ 实时岗位模块 — 飞书多维表格 ═══ */}
      <a
        href={JOB_BOARD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-white hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Table2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-blue-800 group-hover:text-blue-900">秋招实时岗位</h2>
                <p className="text-sm text-gray-500">点击查看飞书多维表格中的最新岗位信息</p>
              </div>
            </div>
            <ExternalLink className="w-5 h-5 text-blue-400 group-hover:text-blue-600 transition-colors shrink-0" />
          </CardContent>
        </Card>
      </a>

      {/* ═══ 标题栏 ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">投递追踪</h1>
          <p className="text-sm text-gray-500 mt-1">{apps.length} 个岗位 · 7阶段追踪</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-md p-0.5">
            <Button variant={view === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setView('kanban')}>
              <LayoutGrid className="w-4 h-4 mr-1" />看板
            </Button>
            <Button variant={view === 'timeline' ? 'default' : 'ghost'} size="sm" onClick={() => setView('timeline')}>
              <Clock className="w-4 h-4 mr-1" />时间线
            </Button>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setForm({ company: '', position: '', city: '', url: '', notes: '', currentStage: 'resume_submitted' });
              setDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />录入投递
          </Button>
        </div>
      </div>

      {/* ═══ 阶段筛选 ═══ */}
      <div className="flex gap-2 flex-wrap">
        <Badge
          variant={filter === '' ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setFilter('')}
        >
          全部
        </Badge>
        {APP_STAGES.map(s => (
          <Badge
            key={s}
            variant={filter === s ? 'default' : 'outline'}
            className={cn('cursor-pointer', stageColor(s))}
            onClick={() => setFilter(s === filter ? '' : s)}
          >
            {stageLabel(s)} ({apps.filter(a => a.currentStage === s).length})
          </Badge>
        ))}
      </div>

      {/* ═══ 看板视图 ═══ */}
      {view === 'kanban' && (
        <KanbanBoard
          applications={filtered}
          onMove={handleMove}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAdd={() => {
            setEditing(null);
            setForm({ company: '', position: '', city: '', url: '', notes: '', currentStage: 'resume_submitted' });
            setDialogOpen(true);
          }}
        />
      )}

      {/* ═══ 时间线卡片视图 ═══ */}
      {view === 'timeline' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(app => (
            <Card key={app.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleDetail(app)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{app.company}</h3>
                    <p className="text-sm text-gray-500">{app.position}</p>
                    {app.city && <p className="text-xs text-gray-400 mt-0.5">{app.city}</p>}
                  </div>
                  <Badge className={cn('text-xs shrink-0', stageColor(app.currentStage))}>
                    {stageLabel(app.currentStage)}
                  </Badge>
                </div>
                <div className="mt-3">
                  <AppTimeline app={app} />
                </div>
                <div className="flex gap-1 mt-2 pt-2 border-t">
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={(e) => { e.stopPropagation(); handleEdit(app); }}>
                    编辑
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7 text-red-500" onClick={(e) => { e.stopPropagation(); handleDelete(app.id); }}>
                    删除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-gray-400 col-span-full text-center py-12">暂无投递记录，点击「录入投递」开始追踪</p>
          )}
        </div>
      )}

      {/* ═══ 录入/编辑弹窗 ═══ */}
      <Dialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        title={editing ? '编辑投递' : '录入新投递'}
      >
        <div className="space-y-3">
          <Input
            placeholder="公司名称 *"
            value={form.company}
            onChange={e => setForm({ ...form, company: e.target.value })}
          />
          <Input
            placeholder="岗位名称 *"
            value={form.position}
            onChange={e => setForm({ ...form, position: e.target.value })}
          />
          <div>
            <label className="text-sm text-gray-600 mb-1 block">当前面试阶段</label>
            <Select
              value={form.currentStage}
              onChange={e => setForm({ ...form, currentStage: e.target.value as ApplicationStage })}
            >
              {STAGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>
          <Input
            placeholder="城市"
            value={form.city}
            onChange={e => setForm({ ...form, city: e.target.value })}
          />
          <Input
            placeholder="投递链接"
            value={form.url}
            onChange={e => setForm({ ...form, url: e.target.value })}
          />
          <Input
            placeholder="备注"
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
          />
          <Button className="w-full" onClick={handleSave}>
            {editing ? '保存修改' : '保存'}
          </Button>
        </div>
      </Dialog>

      {/* ═══ 详情弹窗 ═══ */}
      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selectedApp ? `${selectedApp.company} - ${selectedApp.position}` : ''}
      >
        {selectedApp && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {selectedApp.city && <span>📍 {selectedApp.city}</span>}
              {selectedApp.appliedAt && <span>📅 投递日期: {selectedApp.appliedAt}</span>}
            </div>
            <AppTimeline app={selectedApp} />
            {selectedApp.notes && (
              <p className="text-sm text-gray-600 bg-gray-50 rounded p-2">📝 {selectedApp.notes}</p>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); handleEdit(selectedApp); }}>
                编辑
              </Button>
              <Button variant="outline" size="sm" className="text-red-500" onClick={() => { if (confirm('确定删除？')) { handleDelete(selectedApp.id); setDetailOpen(false); } }}>
                删除
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
