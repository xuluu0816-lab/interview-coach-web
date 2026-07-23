import { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { createSession, prepResumeFile, prepJDFile, cacheText, confirmPrep } from '@/lib/api';
import type { Session, MockInterviewConfig } from '@/types';
import { Upload, ArrowRight, FileText, User, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';

const RESUME_ACCEPT = '.pdf,.docx,.doc,.png,.jpg,.jpeg';
const JD_ACCEPT = '.pdf,.docx,.doc,.png,.jpg,.jpeg,.txt';
const MAX_FILES = 5;

interface JdFileEntry {
  id?: string;
  filename: string;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

interface Props { onStart: (session: Session, config: MockInterviewConfig) => void; }

export function MockSetup({ onStart }: Props) {
  // ── JD 多文件上传 ──
  const [jdFiles, setJdFiles] = useState<JdFileEntry[]>([]);
  const [jdText, setJdText] = useState('');

  // ── 简历 ──
  const [resumeFileId, setResumeFileId] = useState<string | null>(null);
  const [resumeFileName, setResumeFileName] = useState('');
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeStatus, setResumeStatus] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');

  // ── 面试设置 ──
  const [mode, setMode] = useState<MockInterviewConfig['mode']>('mixed');
  const [questionCount, setQuestionCount] = useState(5);
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');
  const [loading, setLoading] = useState(false);

  const resumeRef = useRef<HTMLInputElement>(null);
  const jdFileRef = useRef<HTMLInputElement>(null);

  // ── 简历上传（后端本地解析 + 缓存，文本不可见）──
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeFileName(file.name);
    setResumeUploading(true);
    setResumeStatus('parsing');

    try {
      const result = await prepResumeFile(file);
      setResumeFileId(result.id);
      setResumeStatus('done');
    } catch (err: any) {
      setResumeStatus('error');
      alert('简历上传失败: ' + (err.message === 'Failed to fetch'
        ? '无法连接后端服务器（免费服务器可能正在休眠，请稍后重试）'
        : err.message));
    } finally {
      setResumeUploading(false);
      if (resumeRef.current) resumeRef.current.value = '';
    }
  };

  const clearResume = () => {
    setResumeFileId(null);
    setResumeFileName('');
    setResumeStatus('idle');
  };

  // ── JD 多文件选择 → 并行上传 ──
  const handleJDFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      if (jdFileRef.current) jdFileRef.current.value = '';
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

    if (jdFileRef.current) jdFileRef.current.value = '';
  };

  // ── 移除单个 JD 文件 ──
  const removeJDFile = (index: number) => {
    setJdFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ── 开始模拟面试 ──
  const handleStart = async () => {
    setLoading(true);
    try {
      let resumeText = '';
      let jdTextFinal = '';

      // ① 确认简历：读取缓存 → 智谱 AI 解析
      if (resumeFileId) {
        const result = await confirmPrep(resumeFileId, 'resume');
        resumeText = result.text;
      }

      // ② 确认 JD：多文件缓存 → AI 解析 + 合并 / 手动粘贴 → 缓存 → AI 解析
      const validJdFiles = jdFiles.filter(f => f.status === 'done' && f.id);
      if (validJdFiles.length > 0) {
        const parsedTexts: string[] = [];
        for (const f of validJdFiles) {
          const result = await confirmPrep(f.id!, 'jd');
          if (validJdFiles.length === 1) {
            parsedTexts.push(result.text);
          } else {
            parsedTexts.push(`## ${f.filename}\n${result.text}`);
          }
        }
        jdTextFinal = validJdFiles.length === 1
          ? parsedTexts[0]
          : parsedTexts.join('\n\n---\n\n');
      } else if (jdText.trim()) {
        // 手动粘贴的 JD 文本：先缓存，再调用 AI 解析
        const cached = await cacheText(jdText.trim(), 'jd');
        const result = await confirmPrep(cached.id, 'jd');
        jdTextFinal = result.text;
      }

      const session = await createSession({
        jdText: jdTextFinal || undefined,
        resumeText: resumeText || undefined,
      });
      onStart(session, {
        jdText: jdTextFinal || undefined,
        resumeText: resumeText || undefined,
        mode,
        questionCount,
        language,
      });
    } catch (err: any) {
      alert('创建失败：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const validJdCount = jdFiles.filter(f => f.status === 'done').length;
  const uploadingJdCount = jdFiles.filter(f => f.status === 'uploading').length;
  const canStart = resumeFileId || validJdCount > 0 || jdText.trim();

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h2 className="text-xl font-bold">AI模拟面试配置</h2>
        <p className="text-sm text-gray-500">
          上传简历和JD，AI 基于真实经历深度提问。简历文本不会在前端展示，所有 AI 调用经后端中转。
        </p>
      </div>

      {/* ── JD 卡片 ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />岗位 JD
            <span className="text-xs text-gray-400 font-normal ml-1">（{jdFiles.length}/{MAX_FILES}）</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* JD 文件上传按钮 */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="cursor-pointer">
              <input
                ref={jdFileRef}
                type="file"
                className="hidden"
                accept={JD_ACCEPT}
                multiple
                onChange={handleJDFileSelect}
                disabled={jdFiles.length >= MAX_FILES}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={jdFiles.length >= MAX_FILES}
                onClick={(e) => { e.preventDefault(); jdFileRef.current?.click(); }}
              >
                <Upload className="w-3.5 h-3.5" />
                上传 JD 文件{jdFiles.length > 0 ? `（+）` : ''}
              </Button>
            </label>
            <span className="text-xs text-gray-400">PDF / Word / 图片 / TXT · 支持多选 · 本地解析</span>
          </div>

          {/* JD 文件列表 */}
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
                    onClick={() => removeJDFile(i)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* 或手动粘贴（无文件上传时显示） */}
          {jdFiles.length === 0 && (
            <Textarea
              className="min-h-[120px]"
              placeholder="或直接粘贴岗位 JD 文本..."
              value={jdText}
              onChange={e => setJdText(e.target.value)}
            />
          )}
        </CardContent>
      </Card>

      {/* ── 简历卡片 ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />个人简历
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="cursor-pointer">
              <input
                ref={resumeRef}
                type="file"
                className="hidden"
                accept={RESUME_ACCEPT}
                onChange={handleResumeUpload}
                disabled={resumeUploading}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={resumeUploading}
                onClick={(e) => { e.preventDefault(); resumeRef.current?.click(); }}
              >
                {resumeUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                上传简历文件
              </Button>
            </label>
            <span className="text-xs text-gray-400">PDF / Word / 图片 · 本地 OCR 解析 · 内容不会在前端展示</span>

            {resumeStatus === 'parsing' && (
              <span className="text-xs text-blue-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />{resumeFileName}
              </span>
            )}
            {resumeStatus === 'done' && resumeFileName && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <CheckCircle className="w-3 h-3 text-green-600" />
                {resumeFileName}
                <X className="w-3 h-3 cursor-pointer ml-0.5 hover:text-red-500" onClick={clearResume} />
              </Badge>
            )}
            {resumeStatus === 'error' && (
              <span className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />解析失败
                <X className="w-3 h-3 cursor-pointer hover:text-red-700" onClick={clearResume} />
              </span>
            )}
          </div>

          {!resumeFileId && (
            <p className="text-xs text-gray-400">
              请上传简历文件（PDF / Word / PNG / JPG），上传后仅显示文件名，原始文本不在前端展示。
              点击"开始AI模拟面试"后，后端才会调用智谱大模型进行解析。
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── 面试设置 ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">面试设置</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">提问模式</label>
            <Select value={mode} onChange={e => setMode(e.target.value as any)}>
              <option value="mixed">混合模式</option>
              <option value="deep_dive">纵向深挖</option>
              <option value="cross_scenario">横向拓展</option>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">题目数量</label>
            <Select value={String(questionCount)} onChange={e => setQuestionCount(Number(e.target.value))}>
              {[3, 5, 8, 10].map(n => <option key={n} value={n}>{n} 题</option>)}
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">语言</label>
            <Select value={language} onChange={e => setLanguage(e.target.value as any)}>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Button className="w-full h-12 text-base" onClick={handleStart} disabled={loading || !canStart}>
        {loading ? 'AI 解析中...' : '开始AI模拟面试'}
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}
