import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, gradeColor, gradeLabel } from '@/lib/utils';
import type { ReviewReport as ReviewReportType } from '@/types';
import { Save, FolderOpen, Loader2, FileAudio, Upload, Star, Target } from 'lucide-react';

const STORAGE_KEY = 'review_records';
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function ReviewPage() {
  const [file, setFile] = useState<File | null>(null);
  const [manualText, setManualText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<ReviewReportType | null>(null);
  const [savedRecords, setSavedRecords] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });

  // 选择本地文件（不上传到服务器）
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setFile(f);
    // 不清空已输入的文字
  };

  // AI 分析
  const handleAnalyze = async () => {
    const text = manualText.trim();
    if (!text) { alert('请输入面试对话内容或转写文本'); return; }
    setAnalyzing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/analyze/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text: `以下是面试录音的文字内容，请进行复盘分析：\n\n${text}`, analysis_type: 'interview_review' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: '分析失败' }))).message);
      const data = await res.json();
      setReport(data.report || data);
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        alert('连接后端失败。免费服务器可能正在唤醒（约30秒），请稍后重试。');
      } else {
        alert('AI分析失败：' + err.message);
      }
    } finally { setAnalyzing(false); }
  };

  // 保存到本地
  const handleSave = () => {
    if (!report) return;
    const record = {
      id: Date.now().toString(),
      filename: file?.name || '手动输入',
      date: new Date().toISOString(),
      text: manualText,
      report
    };
    const records = [record, ...savedRecords].slice(0, 50);
    setSavedRecords(records);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  };

  const sizeMB = file ? (file.size / 1024 / 1024).toFixed(1) : '0';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">面试复盘</h1>
        <p className="text-gray-500 text-sm mt-1">选择录音文件 + 粘贴转写文本，AI 生成专业复盘报告</p>
      </div>

      {/* 文件选择 + 文字输入 */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* 文件选择 */}
          <div>
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg hover:border-primary transition-colors">
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600">{file ? file.name : '选择录音/录屏文件（仅用于记录，不上传）'}</span>
              <input type="file" className="hidden" accept=".mp3,.mp4,.wav,.m4a,.webm" onChange={handleFileSelect} />
            </label>
            {file && <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><FileAudio className="w-3 h-3" />{sizeMB}MB</p>}
          </div>

          {/* 文字输入 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">面试对话内容</label>
            <Textarea
              className="min-h-[200px]"
              placeholder={`请粘贴面试的转写文本或手动输入面试对话...\n\n格式示例：\n面试官：请做一下自我介绍\n我：我叫xxx...\n面试官：你最大的缺点是什么\n我：...`}
              value={manualText}
              onChange={e => setManualText(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              💡 方法1：手机录音后用讯飞/微信语音转文字，粘贴到这里<br />
              💡 方法2：回忆面试内容，手动输入关键问答
            </p>
          </div>

          <Button className="w-full" onClick={handleAnalyze} disabled={!manualText.trim() || analyzing}>
            {analyzing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />AI分析中...</> : 'AI生成复盘报告'}
          </Button>
        </CardContent>
      </Card>

      {/* 分析中 */}
      {analyzing && (
        <Card><CardContent className="py-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-gray-500 mt-2">AI 正在分析面试内容...</p>
        </CardContent></Card>
      )}

      {/* 复盘报告 */}
      {report && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSave}><Save className="w-4 h-4 mr-1" />保存报告</Button>
          </div>

          <Card className="border-2 border-primary/20">
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-gray-500">整体评分</p>
              <p className={cn('text-5xl font-bold my-2', report.overall_score >= 28 ? 'text-green-600' : report.overall_score >= 21 ? 'text-yellow-600' : 'text-red-500')}>
                {report.overall_score}<span className="text-xl text-gray-400">/40</span>
              </p>
              <Badge className={cn('text-sm px-3 py-1', gradeColor(report.grade))}>{gradeLabel(report.grade)}</Badge>
              <p className="text-sm text-gray-600 mt-3">{report.overall_feedback}</p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {report.questions.map((q: any, i: number) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div><Badge variant="outline" className="text-xs mb-1">{q.category}</Badge><p className="text-sm font-medium">{q.question_text}</p></div>
                    <span className={cn('text-xl font-bold', q.total >= 28 ? 'text-green-600' : q.total >= 21 ? 'text-yellow-600' : 'text-red-500')}>{q.total}<span className="text-xs text-gray-400">/40</span></span>
                  </div>
                  <p className="text-xs text-gray-500">回答摘要：{q.user_answer_summary}</p>
                  <div className="flex gap-2 text-xs">
                    <span>结构{q.scores.structure}</span><span>内容{q.scores.content}</span><span>表达{q.scores.clarity}</span><span>亮点{q.scores.highlight}</span>
                  </div>
                  {q.feedback?.strengths?.map((s: string, j: number) => (
                    <span key={j} className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded"><Star className="w-3 h-3 inline mr-0.5" />{s}</span>
                  ))}
                  {q.feedback?.improvements?.slice(0, 2).map((imp: any, j: number) => (
                    <div key={j} className="bg-orange-50 rounded p-2 text-xs"><span className="font-medium text-orange-700"><Target className="w-3 h-3 inline mr-0.5" />{imp.title}</span>：{imp.detail}</div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 历史记录 */}
      {savedRecords.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><FolderOpen className="w-4 h-4" />历史记录</h2>
          <div className="space-y-2">
            {savedRecords.map((r: any) => (
              <div key={r.id} className="bg-white border rounded-lg p-3 text-sm flex justify-between items-center">
                <div><span className="font-medium">{r.filename}</span><span className="text-gray-400 ml-2">{r.date?.slice(0, 10)}</span></div>
                <Button variant="ghost" size="sm" onClick={() => { setReport(r.report); setManualText(r.text || ''); }}>查看</Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
