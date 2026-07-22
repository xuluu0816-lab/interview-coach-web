import { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { prepJDFile, analyzeJDPrep } from '@/lib/api';
import type { JdPrepResult, CompanyFramework, BusinessQuestion } from '@/types';
import { Loader2, Copy, Download, RefreshCw, FileText, Building2, Target, CheckCircle, AlertCircle, X, Plus } from 'lucide-react';

const JD_ACCEPT = '.pdf,.docx,.doc,.png,.jpg,.jpeg,.txt';
const MAX_FILES = 5;

interface FileEntry {
  id: string;
  name: string;
  status: 'parsing' | 'done' | 'error';
}

export function JdAnalyzer() {
  // ── JD 文件列表（最多 5 个）──
  const [jdFiles, setJdFiles] = useState<FileEntry[]>([]);

  // ── 用户自定义分析要求 ──
  const [userPrompt, setUserPrompt] = useState('');

  // ── 分析状态 ──
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JdPrepResult | null>(null);
  const [step, setStep] = useState<'input' | 'analyzing' | 'result'>('input');
  const [activeTab, setActiveTab] = useState('framework');

  const fileRef = useRef<HTMLInputElement>(null);

  // ── 添加文件 → 后端本地解析 + 缓存（前端不可见）──
  const handleAddFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (jdFiles.length >= MAX_FILES) {
      alert(`最多上传 ${MAX_FILES} 个文件`);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    const tempEntry: FileEntry = { id: '', name: file.name, status: 'parsing' };
    setJdFiles(prev => [...prev, tempEntry]);

    try {
      const result = await prepJDFile(file);
      setJdFiles(prev => prev.map(f =>
        f.name === file.name && f.status === 'parsing' && !f.id
          ? { id: result.id, name: file.name, status: 'done' as const }
          : f,
      ));
    } catch (err: any) {
      setJdFiles(prev => prev.map(f =>
        f.name === file.name && f.status === 'parsing' && !f.id
          ? { ...f, status: 'error' as const }
          : f,
      ));
      alert('JD 文件解析失败: ' + (err.message === 'Failed to fetch'
        ? '无法连接后端服务器（免费服务器可能正在休眠，请稍后重试）'
        : err.message));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setJdFiles(prev => prev.filter(f => f.id !== id));
  };

  // ── AI 生成分析 ──
  const handleAnalyze = async () => {
    const doneFiles = jdFiles.filter(f => f.status === 'done');
    if (doneFiles.length === 0) return;
    setLoading(true);
    setStep('analyzing');
    try {
      const data = await analyzeJDPrep(doneFiles.map(f => f.id), userPrompt || undefined);
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
    let t = '=== 面试预习报告 ===\n\n【公司概况】\n' + result.companyFramework.overview + '\n\n【业务线】\n' + result.companyFramework.businessLines.join('\n') + '\n\n【竞品】\n' + result.companyFramework.competitors.join('\n') + '\n\n【近期动态】\n' + result.companyFramework.recentNews.join('\n') + '\n\n【面试题】\n';
    result.businessQuestions.forEach((q, i) => { t += `\n${i + 1}. [${q.category}] ${q.question}\n场景：${q.scenario}\n参考：${q.referenceAnswer}\n`; });
    const blob = new Blob([t], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `面试预习_${Date.now()}.txt`; a.click();
  };

  const doneCount = jdFiles.filter(f => f.status === 'done').length;
  const parsingCount = jdFiles.filter(f => f.status === 'parsing').length;
  const canAdd = parsingCount === 0 && jdFiles.length < MAX_FILES;

  return (
    <div className="space-y-4">
      {/* ── 输入面板 ── */}
      {step === 'input' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />JD 预习分析</CardTitle>
            <CardDescription>上传 JD 文件（最多 {MAX_FILES} 个），可选填写分析要求，AI 合并分析生成面试预习报告</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* ① 用户自定义分析要求 */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                补充分析要求 <span className="text-gray-400 font-normal">（可选）</span>
              </label>
              <Textarea
                className="min-h-[80px]"
                placeholder="例如：请重点分析技术栈要求、帮我对比 P7 级别的差距、重点关注业务方向和文化匹配度……"
                value={userPrompt}
                onChange={e => setUserPrompt(e.target.value)}
              />
            </div>

            {/* ② JD 文件列表 + 上传 */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                上传 JD 文件 <span className="text-red-400">*</span>
                <span className="text-gray-400 font-normal ml-1">
                  （{doneCount} 已就绪{jdFiles.length > 0 ? `，共 ${jdFiles.length} 个` : ''}，最多 {MAX_FILES} 个）
                </span>
              </label>

              {/* 文件 badge 列表 */}
              {jdFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {jdFiles.map((f, i) => (
                    <Badge key={f.id || `pending-${i}`} variant="secondary" className="gap-1 text-xs py-1.5 pl-2 pr-1">
                      {f.status === 'parsing' && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                      {f.status === 'done' && <CheckCircle className="w-3 h-3 text-green-600" />}
                      {f.status === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                      <span className="max-w-[200px] truncate">{f.name}</span>
                      {f.status !== 'parsing' && (
                        <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => removeFile(f.id)} />
                      )}
                    </Badge>
                  ))}
                </div>
              )}

              {/* 添加文件按钮 */}
              {canAdd && (
                <label className="cursor-pointer inline-flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept={JD_ACCEPT}
                    onChange={handleAddFile}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={(e) => { e.preventDefault(); fileRef.current?.click(); }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    添加文件
                  </Button>
                  <span className="text-xs text-gray-400">PDF / Word / 图片 / TXT · 后端静默解析</span>
                </label>
              )}
            </div>

            {/* ③ 分析按钮 */}
            <Button onClick={handleAnalyze} disabled={doneCount === 0 || parsingCount > 0 || loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {doneCount > 1 ? `AI 合并分析（${doneCount} 个文件）` : 'AI 生成分析'}
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
            <Button variant="outline" size="sm" onClick={handleCopy}><Copy className="w-4 h-4 mr-1" />复制JSON</Button>
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
