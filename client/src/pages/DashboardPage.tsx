import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { getProgress, getSessions } from '@/lib/api';
import { loadApplications } from '@/lib/storage';
import type { ProgressReport, Session, ApplicationV2 } from '@/types';
import { FileSearch, MessageSquare, ListTodo, Briefcase, ArrowRight } from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<ProgressReport | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [apps, setApps] = useState<ApplicationV2[]>([]);

  useEffect(() => {
    getProgress().then(setProgress).catch(() => {});
    getSessions().then(setSessions).catch(() => {});
    loadApplications().then(setApps).catch(() => {});
  }, []);

  // 面试练习次数：已完成的 AI 模拟面试场次
  const practiceCount = sessions.filter(s => s.status === 'completed').length;

  // 投递统计：与投递追踪页使用同一数据源
  const appTotal = apps.length;
  const appOfferCount = apps.filter(a => a.currentStage === 'final').length;

  const modules = [
    { title: '面试准备', desc: '上传JD/简历，AI生成公司调研 + 面试题 + 模拟面试', icon: FileSearch, color: 'bg-blue-50 text-blue-600', path: '/prep' },
    { title: '面试复盘', desc: '上传录音/录屏，AI转写 + 专业复盘', icon: ListTodo, color: 'bg-purple-50 text-purple-600', path: '/review' },
    { title: '投递追踪', desc: '6阶段看板 · 时间线 · 进度追踪', icon: Briefcase, color: 'bg-orange-50 text-orange-600', path: '/track' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">面试助手</h1><p className="text-gray-500 mt-1">全套面试备战工具，助你拿下心仪Offer</p></div>

      {/* 双卡统计：面试练习 + 投递统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 面试练习次数 */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">面试练习</p>
                <p className="text-2xl font-bold">{practiceCount}</p>
                <p className="text-xs text-gray-400">
                  {practiceCount > 0
                    ? `共 ${progress?.total_questions || 0} 题 · 最近 ${progress?.recent_sessions?.length || 0} 场`
                    : '去 AI模拟面试 开始练习'}
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 投递统计 — 与投递追踪页同数据源 */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/track')}>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">投递统计</p>
                <p className="text-2xl font-bold">{appTotal}</p>
                <p className="text-xs text-gray-400">
                  已投递 · Offer {appOfferCount} 个
                  {appTotal > 0 && ` · ${apps.filter(a => a.currentStage !== 'final').length} 进行中`}
                </p>
              </div>
              <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
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
