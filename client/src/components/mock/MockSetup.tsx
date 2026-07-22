import { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { createSession, parseResumeFile } from '@/lib/api';
import type { Session, MockInterviewConfig } from '@/types';
import { Upload, ArrowRight, FileText, User, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const RESUME_ACCEPT = '.png,.jpg,.jpeg,.pdf,.docx,.doc';

interface Props { onStart: (session: Session, config: MockInterviewConfig) => void; }

export function MockSetup({ onStart }: Props) {
  const [jdText, setJdText] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [mode, setMode] = useState<MockInterviewConfig['mode']>('mixed');
  const [questionCount, setQuestionCount] = useState(5);
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');
  const [loading, setLoading] = useState(false);

  // 简历文件上传状态
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'pdf', 'docx', 'doc'].includes(ext || '')) {
      alert('请上传 PNG / JPG / PDF / Word 格式的简历文件');
      return;
    }

    setUploadName(file.name);
    setUploading(true);
    setUploadStatus('parsing');

    try {
      const result = await parseResumeFile(file);
      setResumeText(result.text);
      setUploadStatus('done');
    } catch (err: any) {
      setUploadStatus('error');
      alert('简历解析失败: ' + (err.message === 'Failed to fetch'
        ? '无法连接后端服务器（免费服务器可能正在休眠，请稍后重试）'
        : err.message));
    } finally {
      setUploading(false);
      // 重置 input 以便重新选择同一文件
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      const session = await createSession({ jdText: jdText || undefined, resumeText: resumeText || undefined });
      onStart(session, { jdText: jdText || undefined, resumeText: resumeText || undefined, mode, questionCount, language });
    } catch (err: any) { alert('创建失败：' + err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div><h2 className="text-xl font-bold">AI模拟面试配置</h2><p className="text-sm text-gray-500">上传JD和简历，AI基于真实经历深度提问</p></div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" />岗位JD</CardTitle></CardHeader>
        <CardContent><Textarea className="min-h-[150px]" placeholder="粘贴目标岗位JD内容..." value={jdText} onChange={e => setJdText(e.target.value)} /></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" />个人简历</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 文件上传按钮 */}
          <div className="flex items-center gap-3">
            <label className="cursor-pointer">
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept={RESUME_ACCEPT}
                onChange={handleResumeUpload}
                disabled={uploading}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={uploading}
                onClick={(e) => { e.preventDefault(); fileRef.current?.click(); }}
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                上传简历文件
              </Button>
            </label>

            <span className="text-xs text-gray-400">
              支持 PNG / JPG / PDF / Word · AI 直接解析
            </span>

            {uploadStatus === 'parsing' && (
              <span className="text-xs text-blue-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {uploadName}
              </span>
            )}
            {uploadStatus === 'done' && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {uploadName} 解析完成
              </span>
            )}
            {uploadStatus === 'error' && (
              <span className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                解析失败
              </span>
            )}
          </div>

          {/* 简历文本编辑 */}
          <Textarea
            className="min-h-[200px]"
            placeholder="粘贴简历内容，或点击上方按钮上传简历文件（AI直接解析PNG/JPG/PDF/Word）..."
            value={resumeText}
            onChange={e => setResumeText(e.target.value)}
          />
        </CardContent>
      </Card>

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

      <Button className="w-full h-12 text-base" onClick={handleStart} disabled={loading}>
        {loading ? '创建中...' : '开始AI模拟面试'}<ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}
