import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { RecordingFile } from '@/types';
import { Upload, Loader2, FileAudio, FileVideo, CheckCircle, AlertCircle } from 'lucide-react';

interface Props { onTranscribed: (recording: RecordingFile) => void; }

export function RecordingUploader({ onTranscribed }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'transcribing' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState<RecordingFile | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setStatus('uploading'); setProgress(30);

    try {
      const token = localStorage.getItem('token');
      const fd = new FormData(); fd.append('file', f);
      const res = await fetch('/api/prep/recording', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
      if (!res.ok) throw new Error('上传失败');
      const data = await res.json();
      setProgress(60); setStatus('transcribing');

      // 轮询转写结果
      const poll = async () => {
        const r = await fetch(`/api/prep/recording/${data.id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!r.ok) throw new Error('查询失败');
        const d = await r.json();
        if (d.status === 'completed') { setRecording(d); setStatus('completed'); setProgress(100); onTranscribed(d); }
        else if (d.status === 'error') { setStatus('error'); setError(d.error || '转写失败'); }
        else { setProgress(prev => Math.min(prev + 10, 90)); setTimeout(poll, 3000); }
      };
      setTimeout(poll, 2000);
    } catch (err: any) { setStatus('error'); setError(err.message); }
  };

  const statusIcons = { idle: <Upload className="w-10 h-10 text-gray-300" />, uploading: <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />, transcribing: <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />, completed: <CheckCircle className="w-10 h-10 text-green-500" />, error: <AlertCircle className="w-10 h-10 text-red-500" /> };

  const statusTexts = { idle: '点击或拖拽上传面试录音/录屏', uploading: '上传中...', transcribing: 'AI转写中...', completed: '转写完成！', error: error || '出错了' };

  return (
    <Card className="border-dashed">
      <CardContent className="py-10 text-center">
        <label className="cursor-pointer block">
          <div className="flex flex-col items-center gap-3">
            {statusIcons[status]}
            <div>
              <p className="text-sm font-medium">{statusTexts[status]}</p>
              {file && <p className="text-xs text-gray-400 mt-1">{file.name} ({(file.size / 1024 / 1024).toFixed(1)}MB)</p>}
              {recording?.duration && <p className="text-xs text-gray-400">时长：{Math.round(recording.duration / 60)}分钟</p>}
            </div>
            {status !== 'completed' && <Progress value={progress} className="max-w-[200px]" />}
          </div>
          <input type="file" className="hidden" accept=".mp3,.mp4,.wav,.m4a,.webm" onChange={handleUpload} disabled={status === 'uploading' || status === 'transcribing'} />
        </label>
        {status === 'error' && <button className="text-sm text-blue-500 mt-3" onClick={() => setStatus('idle')}>重新上传</button>}
      </CardContent>
    </Card>
  );
}
