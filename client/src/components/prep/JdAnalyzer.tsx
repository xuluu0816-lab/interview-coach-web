import { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { prepJDFile, analyzeJDPrep } from '@/lib/api';
import type { JdPrepResult, CompanyFramework, BusinessQuestion } from '@/types';
import { Loader2, Copy, Download, RefreshCw, Upload, FileText, Building2, Target, CheckCircle, AlertCircle, X } from 'lucide-react';

const JD_ACCEPT = '.pdf,.docx,.doc,.png,.jpg,.jpeg,.txt';

export function JdAnalyzer() {
  // ── JD 文本（手动粘贴）──
  const [jdText, setJdText] = useState('');

  // ── JD 文件上传（后端静默解析）──
  const [jdFileId, setJdFileId] = useState<string | null>(null);
  const [jdFileName, setJdFileName] = useState('');
  const [jdUploading, setJdUploading] = useState(false);
  const [jdFileStatus, setJdFileStatus] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');

  // ── 用户自定义分析要求 ──
  const [userPrompt, setUserPrompt] = useState('');

  // ── 分析状态 ──
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JdPrepResult | null>(null);
  const [step, setStep] = useState<'input' | 'analyzing' | 'result'>('input');
  const [activeTab, setActiveTab] = useState('framework');

  const fileRef = useRef<HTMLInputElement>(null);

  // ── 文件上传 → 后端本地解析 + 缓存（前端不可见）──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setJdFileName(file.name);
    setJdUploading(true);
    setJdFileStatus('parsing');

    try {
      const result = await prepJDFile(file);
      setJdFileId(result.id);
      setJdText(''); // 上传文件后清除手动粘贴
      setJdFileStatus('done');
    } catch (err: any) {
      setJdFileStatus('error');
      alert('JD 文件解析失败: ' + (err.message === 'Failed to fetch'
        ? '无法连接后端服务器（免费服务器可能正在休眠，请稍后重试）'
        : err.message));
    } finally {
      setJdUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const clearFile = () => {
    setJdFileId(null);
    setJdFileName('');
    setJdFileStatus('idle');
  };

  // ── AI 生成分析 ──
  const handleAnalyze = async () => {
    if (!jdText.trim() && !jdFileId) return;

    setLoading(true);
    setStep('analyzing');
    try {
      const data = await analyzeJDPrep(
        jdFileId ? undefined : jdText,
        jdFileId || undefined,
        userPrompt || undefined,
      );
      setResult(data);
      setStep('result');
    } catch (err: any) {
      alert('分析失败：' + err.message);
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => { if (result) navigator.clipboard.writeText(JSON.stringify(result, null, 2)); };
  const handleDownload = () => {
    if (!result) return;
    let t = '=== 面试预习报告 ===\n\n【公司概况】\n' + result.companyFramework.overview + '\n\n【业务线】\n' + result.companyFramework.businessLines.join('\n') + '\n\n【竞品】\n' + result.companyFramework.competitors.join('\n') + '\n\n【面试题】\n';
    result.businessQuestions.forEach((q, i) => { t += `\n${i + 1}. [${q.category}] ${q.question}\n场景：${q.scenario}\n参考：${q.referenceAnswer}\n`; });
    const blob = new Blob([t], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `面试预习_${Date.now()}.txt`; a.click();
  };

  const canAnalyze = (jdText.trim() || jdFileId) && !loading;

  return (
    <div className="space-y-4">
      {/* ── 输入面板 ── */}
      {step === 'input' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />JD 预习分析</CardTitle>
            <CardDescription>粘贴 JD 内容或上传 JD 文件，可选填写分析要求，AI 生成面试预习报告</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* JD 文件上传 */}
            <div className="flex items-center gap-3 flex-wrap">
              <label className="cursor-pointer">
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept={JD_ACCEPT}
                  onChange={handleFileUpload}
                  disabled={jdUploading}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={jdUploading}
                  onClick={(e) => { e.preventDefault(); fileRef.current?.click(); }}
                >
                  {jdUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  上传 JD 文件
                </Button>
              </label>
              <span className="text-xs text-gray-400">PDF / Word / 图片 / TXT · 后端静默解析</span>

              {jdFileStatus === 'parsing' && (
                <span className="text-xs text-blue-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />{jdFileName}
                </span>
              )}
              {jdFileStatus === 'done' && jdFileName && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  {jdFileName}
                  <X className="w-3 h-3 cursor-pointer ml-0.5 hover:text-red-500" onClick={clearFile} />
                </Badge>
              )}
              {jdFileStatus === 'error' && (
                <span className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />解析失败
                  <X className="w-3 h-3 cursor-pointer hover:text-red-700" onClick={clearFile} />
                </span>
              )}
            </div>

            {/* 手动粘贴 JD（仅无文件上传时显示）*/}
            {!jdFileId && (
              <Textarea
                className="min-h-[200px]"
                placeholder="粘贴岗位 JD 的纯文本内容..."
                value={jdText}
                onChange={e => setJdText(e.target.value)}
              />
            )}

            {/* 用户自定义分析要求 */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">
                补充分析要求 <span className="text-gray-400">（可选）</span>
              </label>
              <Textarea
                className="min-h-[80px]"
                placeholder="例如：请重点分析技术栈要求、帮我对比 P7 级别的差距、重点关注业务方向和文化匹配度……"
                value={userPrompt}
                onChange={e => setUserPrompt(e.target.value)}
              />
            </div>

            {/* 分析按钮 */}
            <Button onClick={handleAnalyze} disabled={!canAnalyze} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              AI 生成分析
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── 分析中 ── */}
      {step === 'analyzing' && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
            <p className="text-lg font-medium">AI 正在分析 JD{userPrompt ? '（含自定义要求）' : ''}...</p>
            <Progress value={60} className="max-w-xs mx-auto" />
          </CardContent>
        </Card>
      )}

      {/* ── 结果面板 ── */}
      {step === 'result' && result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setStep('input')}><RefreshCw className="w-4 h-4 mr-1" />重新分析</Button>
            <Button variant="outline" size="sm" onClick={handleCopy}><Copy className="w-4 h-4 mr-1" />复制全部</Button>
            <Button variant="outline" size="sm" onClick={handleDownload}><Download className="w-4 h-4 mr-1" />下载TXT</Button>
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="framework"><Building2 className="w-3 h-3 mr-1" />公司调研</TabsTrigger>
              <TabsTrigger value="questions"><Target className="w-3 h-3 mr-1" />面试题</TabsTrigger>
            </TabsList>
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
