import { useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { transcribe, formatSize, isMediaFile } from '@/lib/stt';
import { BASE_URL } from '@/lib/api';
import type { RecordingFile } from '@/types';
import {
  Loader2, CheckCircle, AlertCircle, Clock,
  Mic, RefreshCw, Pencil,
} from 'lucide-react';

interface Props {
  onReady: (recording: RecordingFile) => void;
}

type Status = 'idle' | 'picking' | 'transcribing' | 'done' | 'editing' | 'error';

export function RecordingUploader({ onReady }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [manualText, setManualText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // ── 开始计时 ──
  const startTimer = () => {
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = undefined; }
  };

  // ── 处理文件 ──
  const processFile = useCallback(async (f: File) => {
    setFile(f); setError(''); startTimer();

    if (!isMediaFile(f)) {
      // 非音频文件 → 尝试上传到后端解析
      setStatus('transcribing');
      setProgressMsg('正在上传文件...');
      setProgress(30);

      try {
        const token = localStorage.getItem('token');
        const fd = new FormData(); fd.append('file', f);
        const res = await fetch(`${BASE_URL}/files/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        if (!res.ok) throw new Error(`上传失败 (${res.status})`);
        const uploaded = await res.json();
        stopTimer();
        setStatus('done');
        const rec: RecordingFile = {
          id: uploaded.id, filename: uploaded.filename,
          fileType: 'mp3', fileSize: f.size, status: 'completed',
          transcription: uploaded.parsed_text || undefined,
        };
        onReady(rec);
      } catch (err: any) {
        stopTimer();
        setStatus('error');
        setError(err.message === 'Failed to fetch'
          ? '无法连接后端服务器（免费服务器可能正在休眠，请稍后刷新重试）'
          : err.message);
      }
      return;
    }

    // ── 音频/视频：语音转文字 ──
    setStatus('transcribing');
    try {
      const result = await transcribe(f, (pct, msg) => {
        setProgress(pct);
        setProgressMsg(msg);
      });

      stopTimer();

      if (result.provider === 'manual' || !result.text.trim()) {
        // 自动转写不可用 → 切换到手动输入模式
        setStatus('editing');
        setError(result.error || '请手动粘贴对话文字内容');
        return;
      }

      // 转写成功
      setStatus('done');
      const rec: RecordingFile = {
        id: `stt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        filename: f.name,
        fileType: f.name.endsWith('.mp4') || f.name.endsWith('.webm') ? 'mp4' : 'mp3',
        fileSize: f.size,
        status: 'completed',
        transcription: result.text,
        duration: result.duration,
      };
      onReady(rec);
    } catch (err: any) {
      stopTimer();
      // 转写失败 → 切换到手动输入
      setStatus('editing');
      setError(`自动转写失败: ${err.message}。请在下方手动粘贴对话文字。`);
    }
  }, [onReady]);

  // ── 文件选择 ──
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  // ── 拖拽支持 ──
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  // ── 手动输入提交 ──
  const handleManualSubmit = () => {
    if (!manualText.trim()) return;
    setStatus('done');
    const now = Date.now();
    const rec: RecordingFile = {
      id: `manual_${now}`,
      filename: file?.name || `手动录入_${new Date(now).toLocaleDateString('zh-CN')}`,
      fileType: 'mp3',
      fileSize: 0,
      status: 'completed',
      transcription: manualText.trim(),
    };
    onReady(rec);
  };

  // ── 重试 ──
  const handleRetry = () => {
    setStatus('idle'); setError(''); setProgress(0); setProgressMsg('');
    setManualText(''); setElapsed(0); setFile(null);
  };

  const sizeMB = file ? file.size / 1024 / 1024 : 0;

  return (
    <Card className={dragOver ? 'border-2 border-blue-400 bg-blue-50' : 'border-dashed'}>
      <CardContent
        className="py-10 text-center"
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* ═══ 初始状态 — 上传入口 ═══ */}
        {(status === 'idle' || status === 'picking') && (
          <label className="cursor-pointer block">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                <Mic className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium">点击上传面试录音/视频，AI 自动转文字</p>
                <p className="text-xs text-gray-400 mt-1">
                  支持 mp3 / wav / m4a / mp4 / webm，最大 25MB
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  也支持拖拽文件到此处
                </p>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".mp3,.wav,.m4a,.ogg,.flac,.mp4,.webm,.mov"
              onChange={handleFile}
            />
          </label>
        )}

        {/* ═══ 转写中 ═══ */}
        {status === 'transcribing' && (
          <div className="flex flex-col items-center gap-4 max-w-xs mx-auto">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <div className="w-full space-y-2">
              <p className="text-sm font-medium">{progressMsg || '正在处理...'}</p>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-gray-400">
                {file?.name} ({sizeMB.toFixed(1)}MB)
              </p>
              <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" />{elapsed} 秒
                {elapsed > 15 && '（AI 模型推理中，请耐心等待）'}
              </p>
            </div>
          </div>
        )}

        {/* ═══ 手动输入模式 ═══ */}
        {status === 'editing' && (
          <div className="flex flex-col items-center gap-3 max-w-md mx-auto">
            <div className="flex items-center gap-2 text-amber-600">
              <Pencil className="w-5 h-5" />
              <span className="text-sm font-medium">手动录入对话文字</span>
            </div>
            {error && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded px-3 py-1.5">{error}</p>
            )}
            <Textarea
              className="min-h-[160px] text-left text-sm"
              placeholder={`粘贴面试对话内容，格式示例：\n\n面试官：请做一下自我介绍\n我：我叫...\n面试官：你为什么选择我们公司？\n我：因为...`}
              value={manualText}
              onChange={e => setManualText(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RefreshCw className="w-3 h-3 mr-1" />重新上传
              </Button>
              <Button size="sm" onClick={handleManualSubmit} disabled={!manualText.trim()}>
                <CheckCircle className="w-3 h-3 mr-1" />确认录入
              </Button>
            </div>
          </div>
        )}

        {/* ═══ 转写完成 ═══ */}
        {status === 'done' && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <div>
              <p className="text-sm font-medium text-green-600">转写完成！</p>
              <p className="text-xs text-gray-400">{file?.name} ({formatSize(file?.size || 0)})</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="w-3 h-3 mr-1" />重新上传
            </Button>
          </div>
        )}

        {/* ═══ 上传/转写失败 ═══ */}
        {status === 'error' && !file && (
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <div className="max-w-xs">
              <p className="text-sm font-medium text-red-600">处理失败</p>
              <p className="text-xs text-gray-500 mt-1">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="w-3 h-3 mr-1" />重新上传
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
