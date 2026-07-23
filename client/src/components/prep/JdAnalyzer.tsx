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
const MAX_FILES = 5;

interface JdFileEntry {
  id?: string;
  filename: string;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

export function JdAnalyzer() {
  // ── 多文件上传状态 ──
  const [jdFiles, setJdFiles] = useState<JdFileEntry[]>([]);

  // ── 用户自定义分析要求 ──
  const [userPrompt, setUserPrompt] = useState('');

  // ── 分析状态 ──
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JdPrepResult | null>(null);
  const [step, setStep] = useState<'input' | 'analyzing' | 'result'>('input');
  const [activeTab, setActiveTab] = useState('framework');

  const fileRef = useRef<HTMLInputElement>(null);

  // ── 文件选择 → 并行上传 ──
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    // 过滤：同批次内去重
    const uniqueNew = selectedFiles.filter(
      (f, i, arr) => arr.findIndex(x => x.name === f.name) === i
    );

    // 过滤：不与已有文件重复
    const trulyNew = uniqueNew.filter(
      f => !jdFiles.some(existing => existing.filename === f.name)
    );
    const duplicateCount = uniqueNew.length - trulyNew.length;

    // 检查上限
    const slotsLeft = MAX_FILES - jdFiles.length;
    const filesToUpload = trulyNew.slice(0, slotsLeft);
    const overflowCount = trulyNew.length - filesToUpload.length;

    const messages: string[] = [];
    if (duplicateCount > 0) messages.push(`${duplicateCount} 个文件已存在，已跳过`);
    if (overflowCount > 0) messages.push(`超出上限 ${overflowCount} 个，最多 ${MAX_FILES} 个文件`);
    if (messages.length > 0) alert(messages.join('\n'));

    if (filesToUpload.length === 0) {
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    // 占位：所有新文件标记为 uploading
    const newEntries: JdFileEntry[] = filesToUpload.map(f => ({
      filename: f.name,
      status: 'uploading' as const,
    }));
    setJdFiles(prev => [...prev, ...newEntries]);

    // 并行上传，用 allSettled 保证一个失败不影响其他
    const results = await Promise.allSettled(
      filesToUpload.map(f => prepJDFile(f))
    );

    // 逐个更新状态
    setJdFiles(prev => {
      const updated = [...prev];
      let newIdx = updated.length - newEntries.length;
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          updated[newIdx + i] = { id: r.value.id, filename: r.value.filename, status: 'done' };
        } else {
          const errMsg = r.reason?.message || '上传失败';
          const displayMsg = errMsg === 'Failed to fetch'
            ? '无法连接后端服务器（免费服务器可能正在休眠，请稍后重试）'
            : errMsg;
          updated[newIdx + i] = { filename: filesToUpload[i].name, status: 'error', error: displayMsg };
        }
      });
      return updated;
    });

    if (fileRef.current) fileRef.current.value = '';
  };

  // ── 移除单个文件 ──
  const removeFile = (index: number) => {
    setJdFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ── AI 生成分析 ──
  const handleAnalyze = async () => {
    const validFiles = jdFiles.filter(f => f.status === 'done' && f.id);
    if (validFiles.length === 0) return;

    setLoading(true);
    setStep('analyzing');
    try {
      const fileIds = validFiles.map(f => f.id!);
      const data = await analyzeJDPrep(fileIds, userPrompt || undefined);
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

  const validCount = jdFiles.filter(f => f.status === 'done').length;
  const uploadingCount = jdFiles.filter(f => f.status === 'uploading').length;

  return (
    <div className="space-y-4">
      {/* ── 输入面板 ── */}
      {step === 'input' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />JD 预习分析</CardTitle>
            <CardDescription>上传 JD 文件（最多 {MAX_FILES} 个），可选填写分析要求，AI 生成综合面试预习报告（解析过程在后端完成，不展示原始内容）</CardDescription>
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

            {/* ② JD 文件上传 */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                上传 JD 文件 <span className="text-red-400">*</span>
                <span className="text-gray-400 font-normal ml-1">（{jdFiles.length}/{MAX_FILES}）</span>
              </label>

              {/* 上传按钮 */}
              <div className="flex items-center gap-3 flex-wrap mb-3">
                <label className="cursor-pointer">
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept={JD_ACCEPT}
                    multiple
                    onChange={handleFileSelect}
                    disabled={jdFiles.length >= MAX_FILES}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={jdFiles.length >= MAX_FILES}
                    onClick={(e) => { e.preventDefault(); fileRef.current?.click(); }}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    选择文件{jdFiles.length > 0 ? `（+）` : ''}
                  </Button>
                </label>
                <span className="text-xs text-gray-400">PDF / Word / 图片 / TXT · 支持多选 · 后端静默解析</span>
              </div>

              {/* 文件列表 */}
              {jdFiles.length > 0 && (
                <div className="space-y-1.5 border rounded-lg p-3">
                  {jdFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1">
                      <span className="flex items-center gap-2 min-w-0">
                        {f.status === 'uploading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />}
                        {f.status === 'done' && <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />}
                        {f.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        <span className={`truncate ${f.status === 'error' ? 'text-red-600' : ''}`}>
                          {f.filename}
                          {f.status === 'error' && f.error && (
                            <span className="text-red-400 ml-1 text-xs">— {f.error}</span>
                          )}
                        </span>
                      </span>
                      <X
                        className="w-3.5 h-3.5 cursor-pointer text-gray-400 hover:text-red-500 shrink-0 ml-2"
                        onClick={() => removeFile(i)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ③ 分析按钮 */}
            <Button onClick={handleAnalyze} disabled={validCount === 0 || loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {validCount > 0
                ? `AI 生成分析（基于 ${validCount} 个文件）`
                : uploadingCount > 0 ? `等待 ${uploadingCount} 个文件上传中…` : 'AI 生成分析'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── 分析中 ── */}
      {step === 'analyzing' && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
            <p className="text-lg font-medium">AI 正在分析 {validCount} 个 JD 文件{userPrompt ? '（含自定义要求）' : ''}...</p>
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
