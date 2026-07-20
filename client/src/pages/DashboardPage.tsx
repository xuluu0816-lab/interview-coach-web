import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getProgress, getSessions, getAppStats } from '@/lib/api';
import type { ProgressReport, Session } from '@/types';
import { MessageSquare, FileText, Briefcase, TrendingUp, ArrowRight } from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<ProgressReport | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    getProgress().then(setProgress).catch(() => {});
    getSessions().then(setSessions).catch(() => {});
    getAppStats().then(setStats).catch(() => {});
  }, []);

  const activeSessions = sessions.filter(s => s.status === 'active').length;
  const completedSessions = sessions.filter(s => s.status === 'completed').length;

  const quickActions = [
    {
      title: '开始模拟面试',
      desc: 'AI 面试官带你实战练习',
      icon: MessageSquare,
      color: 'bg-blue-50 text-blue-600',
      path: '/interview',
    },
    {
      title: '上传简历分析',
      desc: '提取STAR素材库',
      icon: FileText,
      color: 'bg-green-50 text-green-600',
      path: '/files',
    },
    {
      title: '查看投递记录',
      desc: `已投递 ${stats?.total || 0} 个岗位`,
      icon: Briefcase,
      color: 'bg-purple-50 text-purple-600',
      path: '/applications',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">面试助手</h1>
        <p className="text-gray-500 mt-1">系统化提升你的面试能力</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">面试练习</p>
                <p className="text-3xl font-bold mt-1">{completedSessions}</p>
                <p className="text-xs text-gray-400 mt-1">
                  已完成 {completedSessions} 场{activeSessions > 0 && `，${activeSessions} 场进行中`}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">平均评分</p>
                <p className="text-3xl font-bold mt-1">
                  {progress ? `${progress.avg_score}/${40}` : '--'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  趋势：{progress?.trend === 'UP' ? '📈 上升中' : progress?.trend === 'DOWN' ? '📉 下降中' : '➡️ 平稳'}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">投递统计</p>
                <p className="text-3xl font-bold mt-1">{stats?.total || 0}</p>
                <p className="text-xs text-gray-400 mt-1">
                  通过率 {stats?.pass_rate || 0}%{stats?.offer_count > 0 && ` · ${stats.offer_count} 个 Offer`}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 快速操作 */}
      <div>
        <h2 className="text-lg font-semibold mb-3">快速开始</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map(action => (
            <Card
              key={action.title}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(action.path)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color}`}>
                    <action.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{action.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{action.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 mt-3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 最近练习 */}
      {progress?.recent_sessions?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">最近练习</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {progress.recent_sessions.slice(-5).reverse().map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <span className="text-sm font-medium">{s.company}</span>
                    <span className="text-xs text-gray-400 ml-2">{s.role}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{s.question_count} 题</span>
                    <span className="text-xs text-gray-400">{s.date?.slice(0, 10)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
