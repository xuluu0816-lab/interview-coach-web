import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RecordingUploader } from '@/components/review/RecordingUploader';
import { ReviewReport } from '@/components/review/ReviewReport';
import { getFileDetail } from '@/lib/api';
import type { RecordingFile, ReviewReport as ReviewReportType } from '@/types';
import { Save, FolderOpen, Loader2, Wifi } from 'lucide-react';

const STORAGE_KEY = 'review_records';

export default function ReviewPage() {
  const [recording, setRecording] = useState<RecordingFile | null>(null);
  const [report, setReport] = useState<ReviewReportType | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [backendReady, setBackendReady] = useState(false);
  const [backendError, setBackendError] = useState('');
  const [savedRecords, setSavedRecords] = useState<RecordingFile[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });

  // 页面加载时唤醒休眠的 Render 后端
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50000); // 50秒超时

    fetch(`${apiBase}/health`, { signal: controller.signal })
      .then(r => { if (r.ok) setBackendReady(true); else setBackendError('服务器异常'); })
      .catch(() => setBackendError('后端连接超时，请刷新重试'))
      .finally(() => clearTimeout(timer));
  }, []);

  const handleReady = async (rec: RecordingFile) => {
    setRecording(rec);
    if (rec.transcription) {
      setAnalyzing(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/analyze/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ text: rec.transcription, analysis_type: 'interview_review' }),
        });
        if (!res.ok) throw new Error('分析失败');
        const data = await res.json();
        setReport(data.report || data);
      } catch (err: any) { alert('AI分析失败：' + err.message); }
      finally { setAnalyzing(false); }
    }
  };

  const handleSave = () => {
    if (!recording) return;
    const records = [recording, ...savedRecords.filter(r => r.id !== recording.id)].slice(0, 50);
    setSavedRecords(records); localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold">面试复盘</h1><p className="text-gray-500 text-sm mt-1">上传面试录音/录屏，AI转写并生成专业复盘报告</p></div>

      {!backendReady && !backendError && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3 text-sm text-blue-700">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span>正在唤醒后端服务（免费服务器会休眠，首次唤醒约 30 秒）...</span>
        </div>
      )}
      {backendError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-sm text-red-700">
          <Wifi className="w-4 h-4 flex-shrink-0" />
          <span>{backendError}。请点击右上角刷新或稍后再试。</span>
        </div>
      )}

      {backendReady && <RecordingUploader onReady={handleReady} />}

      {recording?.transcription && (
        <div>
          <h2 className="text-lg font-semibold mb-2">解析文本</h2>
          <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto"><pre className="text-sm text-gray-700 whitespace-pre-wrap">{recording.transcription}</pre></div>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={handleSave}><Save className="w-4 h-4 mr-1" />保存到本地</Button>
            <Button variant="outline" size="sm" onClick={() => handleReady(recording)} disabled={analyzing}>{analyzing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}AI分析</Button>
          </div>
        </div>
      )}

      {analyzing && <p className="text-sm text-gray-500">AI 正在分析中...</p>}
      {report && <ReviewReport report={report} />}

      {savedRecords.length > 0 && (
        <div><h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><FolderOpen className="w-4 h-4" />历史记录 ({savedRecords.length})</h2>
          <div className="space-y-2">
            {savedRecords.map(r => (
              <div key={r.id} className="bg-white border rounded-lg p-3 text-sm flex justify-between items-center">
                <div><span className="font-medium">{r.filename}</span><span className="text-gray-400 ml-2">{new Date(r.id || '').toLocaleString('zh-CN')}</span></div>
                <Button variant="ghost" size="sm" onClick={() => { setRecording(r); if (r.report) setReport(r.report); else handleReady(r); }}>查看</Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
