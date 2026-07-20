import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RecordingUploader } from '@/components/review/RecordingUploader';
import { ReviewReport } from '@/components/review/ReviewReport';
import type { RecordingFile, ReviewReport as ReviewReportType } from '@/types';
import { Save, FolderOpen } from 'lucide-react';

const STORAGE_KEY = 'review_records';

export default function ReviewPage() {
  const [recording, setRecording] = useState<RecordingFile | null>(null);
  const [report, setReport] = useState<ReviewReportType | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [savedRecords, setSavedRecords] = useState<RecordingFile[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });

  const handleTranscribed = async (rec: RecordingFile) => {
    setRecording(rec);
    if (rec.transcription) {
      setAnalyzing(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/prep/recording/${rec.id}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (!res.ok) throw new Error('分析失败');
        const data = await res.json();
        setReport(data.report);
        // 更新 recording 记录
        const updated = { ...rec, report: data.report };
        setRecording(updated);
      } catch (err: any) { alert('AI分析失败：' + err.message); }
      finally { setAnalyzing(false); }
    }
  };

  const handleSave = () => {
    if (!recording) return;
    const records = [recording, ...savedRecords.filter(r => r.id !== recording.id)].slice(0, 50);
    setSavedRecords(records);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">面试复盘</h1>
        <p className="text-gray-500 text-sm mt-1">上传面试录音/录屏，AI自动转写并生成专业复盘报告</p>
      </div>

      <RecordingUploader onTranscribed={handleTranscribed} />

      {recording && (
        <div>
          <h2 className="text-lg font-semibold mb-2">转写文本</h2>
          <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap">{recording.transcription || '转写中...'}</pre>
          </div>
          <Button variant="outline" size="sm" className="mt-2" onClick={handleSave}>
            <Save className="w-4 h-4 mr-1" />保存到本地
          </Button>
        </div>
      )}

      {analyzing && <p className="text-sm text-gray-500">AI 正在生成复盘报告...</p>}

      {report && <ReviewReport report={report} />}

      {savedRecords.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><FolderOpen className="w-4 h-4" />历史复盘记录</h2>
          <div className="space-y-2">
            {savedRecords.map(r => (
              <div key={r.id} className="bg-white border rounded-lg p-3 text-sm flex justify-between items-center">
                <div><span className="font-medium">{r.filename}</span><span className="text-gray-400 ml-2">{new Date(r.id || '').toLocaleString('zh-CN')}</span></div>
                <Button variant="ghost" size="sm" onClick={() => { setRecording(r); if (r.report) setReport(r.report); }}>查看</Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
