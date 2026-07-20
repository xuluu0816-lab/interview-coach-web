import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { uploadFile, getFileDetail } from '@/lib/api';
import type { JdPrepResult, CompanyFramework, BusinessQuestion } from '@/types';
import { Loader2, Copy, Download, RefreshCw, Upload, FileText, Building2, Target } from 'lucide-react';

export function JdAnalyzer() {
  const [jdText, setJdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JdPrepResult | null>(null);
  const [step, setStep] = useState<'input' | 'analyzing' | 'result'>('input');
  const [activeTab, setActiveTab] = useState('framework');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setLoading(true);
    try {
      // 所有文件统一走后端上传解析（含 OCR）
      const uploaded = await uploadFile(file);
      const detail = await getFileDetail(uploaded.id);
      if (detail.parsed_text && !detail.parsed_text.startsWith('[图片文件]') && !detail.parsed_text.startsWith('[音视频')) {
        setJdText(detail.parsed_text);
      } else if (!detail.parsed_text?.trim()) {
        alert('未能解析到文字内容，请确认文件清晰度或手动粘贴JD内容。');
      }
    } catch (err: any) { alert('文件解析失败：' + err.message); }
    finally { setLoading(false); }
  };

  const handleAnalyze = async () => {
    if (!jdText.trim()) return;
    setLoading(true); setStep('analyzing');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/analyze/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text: jdText, analysis_type: 'jd_prep' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: '分析失败' }))).message);
      const data = await res.json();
      setResult(data); setStep('result');
    } catch (err: any) { alert('分析失败：' + err.message); setStep('input'); }
    finally { setLoading(false); }
  };

  const handleCopy = () => { if (result) navigator.clipboard.writeText(JSON.stringify(result, null, 2)); };
  const handleDownload = () => {
    if (!result) return;
    let t = '=== 面试预习报告 ===\n\n【公司概况】\n' + result.companyFramework.overview + '\n\n【业务线】\n' + result.companyFramework.businessLines.join('\n') + '\n\n【竞品】\n' + result.companyFramework.competitors.join('\n') + '\n\n【面试题】\n';
    result.businessQuestions.forEach((q, i) => { t += `\n${i + 1}. [${q.category}] ${q.question}\n场景：${q.scenario}\n参考：${q.referenceAnswer}\n`; });
    const blob = new Blob([t], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `面试预习_${Date.now()}.txt`; a.click();
  };

  return (
    <div className="space-y-4">
      {step === 'input' && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />JD文本输入</CardTitle><CardDescription>粘贴目标岗位JD，或上传JD文件（PDF/Word/TXT）</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Textarea className="min-h-[200px]" placeholder="粘贴岗位JD的纯文本内容..." value={jdText} onChange={e => setJdText(e.target.value)} />
            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><Upload className="w-4 h-4" />上传JD文件<input type="file" className="hidden" accept=".txt,.pdf,.docx,.png,.jpg,.jpeg" onChange={handleFileUpload} /></label>
              <Button onClick={handleAnalyze} disabled={!jdText.trim() || loading}>{loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}AI生成分析</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'analyzing' && (
        <Card><CardContent className="py-12 text-center space-y-4"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /><p className="text-lg font-medium">AI 正在分析JD...</p><Progress value={60} className="max-w-xs mx-auto" /></CardContent></Card>
      )}

      {step === 'result' && result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setStep('input')}><RefreshCw className="w-4 h-4 mr-1" />重新生成</Button>
            <Button variant="outline" size="sm" onClick={handleCopy}><Copy className="w-4 h-4 mr-1" />复制全部</Button>
            <Button variant="outline" size="sm" onClick={handleDownload}><Download className="w-4 h-4 mr-1" />下载TXT</Button>
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList><TabsTrigger value="framework"><Building2 className="w-3 h-3 mr-1" />公司调研</TabsTrigger><TabsTrigger value="questions"><Target className="w-3 h-3 mr-1" />面试题</TabsTrigger></TabsList>
            <TabsContent value="framework"><FrameworkView framework={result.companyFramework} /></TabsContent>
            <TabsContent value="questions"><QuestionsView questions={result.businessQuestions} /></TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

function FrameworkView({ framework }: { framework: CompanyFramework }) {
  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle className="text-base">公司概况</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-700 whitespace-pre-wrap">{framework.overview}</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">核心业务线</CardTitle></CardHeader><CardContent><ul className="list-disc list-inside space-y-1">{framework.businessLines.map((b, i) => <li key={i} className="text-sm">{b}</li>)}</ul></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">竞品分析</CardTitle></CardHeader><CardContent><ul className="list-disc list-inside space-y-1">{framework.competitors.map((c, i) => <li key={i} className="text-sm">{c}</li>)}</ul></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">近期动态</CardTitle></CardHeader><CardContent><ul className="list-disc list-inside space-y-1">{framework.recentNews.map((n, i) => <li key={i} className="text-sm">{n}</li>)}</ul></CardContent></Card>
      <div className="grid grid-cols-2 gap-4"><Card><CardHeader><CardTitle className="text-base">企业文化</CardTitle></CardHeader><CardContent><p className="text-sm">{framework.culture}</p></CardContent></Card><Card><CardHeader><CardTitle className="text-base">面试风格</CardTitle></CardHeader><CardContent><p className="text-sm">{framework.interviewStyle}</p></CardContent></Card></div>
    </div>
  );
}

function QuestionsView({ questions }: { questions: BusinessQuestion[] }) {
  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <Card key={q.id || i}><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">{i + 1}. {q.question}</CardTitle><Badge variant="secondary" className="text-xs">{q.category}</Badge></div></CardHeader><CardContent><p className="text-xs text-gray-500 mb-2">场景：{q.scenario}</p><p className="text-xs text-blue-700 bg-blue-50 p-2 rounded whitespace-pre-wrap">参考要点：{q.referenceAnswer}</p></CardContent></Card>
      ))}
    </div>
  );
}
