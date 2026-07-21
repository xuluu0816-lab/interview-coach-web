import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RecordingUploader } from '@/components/review/RecordingUploader';
import { ReviewReport } from '@/components/review/ReviewReport';
import { BASE_URL } from '@/lib/api';
import type { RecordingFile, ReviewReport as ReviewReportType } from '@/types';
import {
  Save, FolderOpen, Loader2, Copy, Download, Trash2,
  Edit3, X, Mic, FileText, ChevronDown, ChevronUp,
} from 'lucide-react';

const STORAGE_KEY = 'review_transcriptions';

interface SavedTranscription {
  id: string;
  filename: string;
  text: string;
  fileSize: number;
  fileType: string;
  duration?: number;
  createdAt: string;
  report?: ReviewReportType | null;
}

export default function ReviewPage() {
  const [recording, setRecording] = useState<RecordingFile | null>(null);
  const [report, setReport] = useState<ReviewReportType | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [editingText, setEditingText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [savedRecords, setSavedRecords] = useState<SavedTranscription[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── 收到转写结果 ──
  const handleReady = (rec: RecordingFile) => {
    setRecording(rec);
    setReport(null);
    if (rec.transcription) {
      setEditingText(rec.transcription);
    }
  };

  // ── 保存到本地存储 ──
  const handleSave = () => {
    const text = isEditing ? editingText : recording?.transcription;
    if (!recording || !text) return;

    const record: SavedTranscription = {
      id: recording.id,
      filename: recording.filename,
      text,
      fileSize: recording.fileSize,
      fileType: recording.fileType,
      duration: recording.duration,
      createdAt: new Date().toISOString(),
      report,
    };

    const updated = [record, ...savedRecords.filter(r => r.id !== record.id)].slice(0, 50);
    setSavedRecords(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // 同步更新 recording
    setRecording({ ...recording, transcription: text });
    if (isEditing) setIsEditing(false);
  };

  // ── AI 面试复盘分析 ──
  const handleAnalyze = async () => {
    const text = isEditing ? editingText : recording?.transcription;
    if (!text?.trim()) return;

    setAnalyzing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/analyze/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text, analysis_type: 'interview_review' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: '分析失败' }))).message);
      const data = await res.json();
      const r = data.report || data;
      setReport(r);

      // 更新历史记录中的报告
      if (recording) {
        const updated = savedRecords.map(rec =>
          rec.id === recording.id ? { ...rec, report: r } : rec
        );
        setSavedRecords(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (err: any) {
      alert('AI分析失败: ' + (err.message === 'Failed to fetch'
        ? '无法连接后端服务器，请稍后重试（免费服务器可能正在休眠）'
        : err.message));
    } finally {
      setAnalyzing(false);
    }
  };

  // ── 复制文字 ──
  const handleCopy = () => {
    const text = recording?.transcription || '';
    navigator.clipboard.writeText(text).then(() => {
      // 短暂提示
      const el = document.createElement('span');
      el.textContent = '已复制';
      el.className = 'text-xs text-green-600';
      // simple feedback
    }).catch(() => alert('复制失败，请手动全选复制'));
  };

  // ── 下载为 TXT ──
  const handleDownload = () => {
    const text = isEditing ? editingText : recording?.transcription;
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recording?.filename?.replace(/\.[^.]+$/, '') || '面试复盘'}_转写.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── 删除历史记录 ──
  const handleDeleteRecord = (id: string) => {
    const updated = savedRecords.filter(r => r.id !== id);
    setSavedRecords(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (recording?.id === id) {
      setRecording(null);
      setReport(null);
    }
  };

  // ── 从历史加载 ──
  const handleLoadRecord = (rec: SavedTranscription) => {
    const rf: RecordingFile = {
      id: rec.id,
      filename: rec.filename,
      fileType: rec.fileType as 'mp3' | 'mp4',
      fileSize: rec.fileSize,
      status: 'completed',
      transcription: rec.text,
      duration: rec.duration,
    };
    setRecording(rf);
    setEditingText(rec.text);
    setIsEditing(false);
    setReport(rec.report || null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ═══ 标题栏 ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">面试复盘</h1>
          <p className="text-gray-500 text-sm mt-1">上传面试录音/视频，AI 语音转文字，生成专业复盘报告</p>
        </div>
        {recording && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="w-4 h-4 mr-1" />复制
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-1" />下载 TXT
            </Button>
          </div>
        )}
      </div>

      {/* ═══ 上传区 ═══ */}
      <RecordingUploader onReady={handleReady} />

      {/* ═══ 转写结果 ═══ */}
      {recording?.transcription && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />转写文字
            </h2>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                    <X className="w-3 h-3 mr-1" />取消
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    <Save className="w-3 h-3 mr-1" />保存修改
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => { setIsEditing(true); setEditingText(recording.transcription || ''); }}>
                  <Edit3 className="w-3 h-3 mr-1" />编辑
                </Button>
              )}
            </div>
          </div>

          {isEditing ? (
            <Textarea
              className="min-h-[200px] font-mono text-sm"
              value={editingText}
              onChange={e => setEditingText(e.target.value)}
              placeholder="编辑转写文字..."
            />
          ) : (
            <div className="bg-gray-50 rounded-lg p-4 max-h-80 overflow-y-auto border">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {recording.transcription}
              </pre>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleSave} size="sm" disabled={isEditing}>
              <Save className="w-4 h-4 mr-1" />保存到记录
            </Button>
            <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={analyzing}>
              {analyzing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mic className="w-4 h-4 mr-1" />}
              AI 生成复盘报告
            </Button>
          </div>
        </div>
      )}

      {/* ═══ AI 分析中 ═══ */}
      {analyzing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          <div>
            <p className="text-sm font-medium text-blue-700">AI 正在分析面试对话...</p>
            <p className="text-xs text-blue-500 mt-0.5">分析对话质量、给出改进建议，预计 10-30 秒</p>
          </div>
        </div>
      )}

      {/* ═══ 复盘报告 ═══ */}
      {report && <ReviewReport report={report} />}

      {/* ═══ 历史记录 ═══ */}
      {savedRecords.length > 0 && (
        <div>
          <button
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 mb-2"
            onClick={() => setHistoryOpen(!historyOpen)}
          >
            <FolderOpen className="w-4 h-4" />
            历史记录 ({savedRecords.length})
            {historyOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {historyOpen && (
            <div className="space-y-2">
              {savedRecords.map(r => (
                <div
                  key={r.id}
                  className={`bg-white border rounded-lg p-3 text-sm flex items-center justify-between gap-2 ${recording?.id === r.id ? 'border-blue-300 bg-blue-50' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{r.filename}</span>
                      {r.duration && (
                        <span className="text-xs text-gray-400 shrink-0">
                          {Math.round(r.duration)}秒
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {new Date(r.createdAt).toLocaleString('zh-CN')}
                      </span>
                      <span className="text-xs text-gray-400">· {r.text.length} 字</span>
                      {r.report && (
                        <Badge variant="secondary" className="text-[10px] h-4">有报告</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleLoadRecord(r)}>
                      查看
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="text-xs h-7 text-red-500"
                      onClick={() => { if (confirm('确定删除这条记录？')) handleDeleteRecord(r.id); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
