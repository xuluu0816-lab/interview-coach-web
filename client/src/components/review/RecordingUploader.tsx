import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { uploadFile } from '@/lib/api';
import type { RecordingFile } from '@/types';
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface Props { onReady: (recording: RecordingFile) => void; }

export function RecordingUploader({ onReady }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState<RecordingFile | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setFile(f); setStatus('uploading'); setProgress(30);
    try {
      const uploaded = await uploadFile(f);
      setProgress(100); setStatus('done');
      const rec: RecordingFile = { id: uploaded.id, filename: uploaded.filename, fileType: (f.name.endsWith('.mp4') ? 'mp4' : 'mp3'), fileSize: f.size, status: 'completed', transcription: uploaded.parsed_text || undefined };
      setRecording(rec); onReady(rec);
    } catch (err: any) { setStatus('error'); setError(err.message); }
  };

  const statusIcons = { idle: <Upload className="w-10 h-10 text-gray-300" />, uploading: <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />, done: <CheckCircle className="w-10 h-10 text-green-500" />, error: <AlertCircle className="w-10 h-10 text-red-500" /> };
  const statusTexts = { idle: '点击或拖拽上传面试录音/录屏', uploading: '上传中...', done: '上传完成！', error: error || '出错了' };

  return (
    <Card className="border-dashed">
      <CardContent className="py-10 text-center">
        <label className="cursor-pointer block">
          <div className="flex flex-col items-center gap-3">
            {statusIcons[status]}
            <div><p className="text-sm font-medium">{statusTexts[status]}</p>
              {file && <p className="text-xs text-gray-400 mt-1">{file.name} ({(file.size / 1024 / 1024).toFixed(1)}MB)</p>}
            </div>
            {status !== 'done' && <Progress value={progress} className="max-w-[200px]" />}
          </div>
          <input type="file" className="hidden" accept=".mp3,.mp4,.wav,.m4a,.webm" onChange={handleUpload} disabled={status === 'uploading'} />
        </label>
        {status === 'error' && <button className="text-sm text-blue-500 mt-3" onClick={() => setStatus('idle')}>重新上传</button>}
      </CardContent>
    </Card>
  );
}
