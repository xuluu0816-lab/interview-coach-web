import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { getProgress, getSessions, getAppStats } from '@/lib/api';
import type { ProgressReport, Session } from '@/types';
import { FileSearch, MessageSquare, ListTodo, Briefcase, ArrowRight, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<ProgressReport | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => { getProgress().then(setProgress).catch(() => {}); getSessions().then(setSessions).catch(() => {}); getAppStats().then(setStats).catch(() => {}); }, []);

  const modules = [
    { title: '面试预习', desc: '上传JD，AI生成公司调研 + 面试题', icon: FileSearch, color: 'bg-blue-50 text-blue-600', path: '/prep' },
    { title: '面试复盘', desc: '上传录音/录屏，AI转写 + 专业复盘', icon: ListTodo, color: 'bg-purple-50 text-purple-600', path: '/review' },
    { title: 'AI模拟面试', desc: 'JD+简历 → AI双向深度追问', icon: MessageSquare, color: 'bg-green-50 text-green-600', path: '/mock' },
    { title: '投递追踪', desc: '6阶段看板 · 时间线 · 进度追踪', icon: Briefcase, color: 'bg-orange-50 text-orange-600', path: '/track' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">面试助手</h1><p className="text-gray-500 mt-1">全套面试备战工具，助你拿下心仪Offer</p></div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-5"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">面试练习</p><p className="text-2xl font-bold">{sessions.filter(s => s.status === 'completed').length}</p><p className="text-xs text-gray-400">已完成场次</p></div><div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center"><MessageSquare className="w-5 h-5 text-blue-600" /></div></div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">平均评分</p><p className="text-2xl font-bold">{progress ? `${progress.avg_score}/40` : '--'}</p><p className="text-xs text-gray-400">趋势：{progress?.trend === 'UP' ? '上升中' : progress?.trend === 'DOWN' ? '下降中' : '平稳'}</p></div><div className="w-10 h-10 bg-yellow-50 rounded-full flex items-center justify-center"><TrendingUp className="w-5 h-5 text-yellow-600" /></div></div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">投递统计</p><p className="text-2xl font-bold">{stats?.total || 0}</p><p className="text-xs text-gray-400">Offer {stats?.offer_count || 0} 个</p></div><div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center"><Briefcase className="w-5 h-5 text-green-600" /></div></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map(m => (
          <Card key={m.path} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(m.path)}>
            <CardContent className="pt-5">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${m.color}`}><m.icon className="w-5 h-5" /></div>
                <div className="flex-1"><h3 className="font-semibold">{m.title}</h3><p className="text-sm text-gray-500 mt-0.5">{m.desc}</p></div>
                <ArrowRight className="w-4 h-4 text-gray-300 mt-2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {progress?.recent_sessions && progress.recent_sessions.length > 0 && (
        <Card>
          <div className="p-4">
            <h3 className="font-semibold mb-2">最近练习</h3>
            <div className="space-y-2">
              {progress.recent_sessions.slice(-5).reverse().map((s, i) => (
                <div key={i} className="flex justify-between text-sm border-b pb-2 last:border-0"><span>{s.company} · {s.role}</span><span className="text-gray-400">{s.question_count}题 · {s.date?.slice(0, 10)}</span></div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
