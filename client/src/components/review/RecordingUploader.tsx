import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BASE_URL } from '@/lib/api';
import type { RecordingFile } from '@/types';
import { Upload, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface Props { onReady: (recording: RecordingFile) => void; }

export function RecordingUploader({ onReady }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setFile(f); setStatus('uploading'); setError(''); setElapsed(0);

    // 计时器：每2秒更新，显示上传耗时
    const timer = setInterval(() => setElapsed(prev => prev + 2), 2000);

    try {
      // 120秒超时
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);

      const token = localStorage.getItem('token');
      const fd = new FormData(); fd.append('file', f);
      const res = await fetch(`${BASE_URL}/files/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
        signal: controller.signal,
      });

      clearTimeout(timeout); clearInterval(timer);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: '上传失败' }));
        throw new Error(errData.message || `服务器错误 (${res.status})`);
      }

      const uploaded = await res.json();
      setStatus('done');
      const rec: RecordingFile = {
        id: uploaded.id, filename: uploaded.filename,
        fileType: (f.name.endsWith('.mp4') ? 'mp4' : 'mp3'),
        fileSize: f.size, status: 'completed',
        transcription: uploaded.parsed_text || undefined,
      };
      onReady(rec);
    } catch (err: any) {
      clearInterval(timer);
      setStatus('error');
      if (err.name === 'AbortError') {
        setError('上传超时（2分钟），请检查网络后重试');
      } else if (err.message === 'Failed to fetch') {
        setError('无法连接后端服务器，请稍后重试（免费服务器可能正在唤醒）');
      } else {
        setError(err.message);
      }
    }
  };

  const sizeMB = file ? (file.size / 1024 / 1024).toFixed(1) : '0';

  return (
    <Card className="border-dashed">
      <CardContent className="py-10 text-center">
        {status === 'idle' && (
          <label className="cursor-pointer block">
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-gray-300" />
              <div>
                <p className="text-sm font-medium">点击或拖拽上传面试录音/录屏</p>
                <p className="text-xs text-gray-400 mt-1">支持 mp3 / mp4 / wav / m4a / webm，最大 50MB</p>
              </div>
            </div>
            <input type="file" className="hidden" accept=".mp3,.mp4,.wav,.m4a,.webm" onChange={handleUpload} />
          </label>
        )}

        {status === 'uploading' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <div>
              <p className="text-sm font-medium">正在上传中...</p>
              <p className="text-xs text-gray-400 mt-1">{file?.name} ({sizeMB}MB)</p>
              <p className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" />已等待 {elapsed} 秒{elapsed > 40 ? '（服务器唤醒中，请耐心等待）' : ''}
              </p>
            </div>
          </div>
        )}

        {status === 'done' && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <div><p className="text-sm font-medium text-green-600">上传完成！</p><p className="text-xs text-gray-400">{file?.name} ({sizeMB}MB)</p></div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <div className="max-w-xs"><p className="text-sm font-medium text-red-600">上传失败</p><p className="text-xs text-gray-500 mt-1">{error}</p></div>
            <button className="text-sm text-blue-500 hover:underline" onClick={() => setStatus('idle')}>重新上传</button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
