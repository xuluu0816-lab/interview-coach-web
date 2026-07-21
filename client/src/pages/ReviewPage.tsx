import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RecordingUploader } from '@/components/review/RecordingUploader';
import { ReviewReport } from '@/components/review/ReviewReport';
import { QAPairEditor } from '@/components/review/QAPairEditor';
import { BASE_URL } from '@/lib/api';
import { groupSegmentsByPause, DEFAULT_PAUSE_THRESHOLD } from '@/lib/stt';
import type { WhisperSegment } from '@/lib/stt';
import type { RecordingFile, ReviewReport as ReviewReportType, QAPair } from '@/types';
import {
  Save, FolderOpen, Loader2, Copy, Download, Trash2,
  Edit3, X, Mic, FileText, ChevronDown, ChevronUp, SlidersHorizontal,
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
  qaPairs?: QAPair[];
  segments?: WhisperSegment[];
}

/** 将 QAPair 数组格式化为结构化文本 */
function formatQAPairsForExport(qaPairs: QAPair[], filename: string): string {
  if (!qaPairs || qaPairs.length === 0) return '';
  const lines: string[] = [];
  lines.push(`面试复盘 — ${filename}`);
  lines.push('='.repeat(42));
  lines.push('');
  qaPairs.forEach((pair, i) => {
    lines.push(`Q${i + 1}: ${pair.question || '(未填写问题)'}`);
    lines.push(`A${i + 1}: ${pair.answer || '(无回答)'}`);
    if (pair.startTime !== undefined && pair.endTime !== undefined) {
      const fm = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
      lines.push(`   [时间: ${fm(pair.startTime)} — ${fm(pair.endTime)}]`);
    }
    lines.push('');
  });
  return lines.join('\n');
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

  // ── Q&A 编辑器状态 ──
  const [currentQAPairs, setCurrentQAPairs] = useState<QAPair[]>([]);
  const [rawSegments, setRawSegments] = useState<WhisperSegment[]>([]);
  const [pauseThreshold, setPauseThreshold] = useState(DEFAULT_PAUSE_THRESHOLD);

  // ── 收到转写结果 ──
  const handleReady = (rec: RecordingFile) => {
    setRecording(rec);
    setReport(null);
    if (rec.transcription) {
      setEditingText(rec.transcription);
    }
    if (rec.qaPairs) {
      setCurrentQAPairs(rec.qaPairs);
    }
    if (rec.segments && rec.segments.length > 0) {
      setRawSegments(rec.segments);
      setPauseThreshold(DEFAULT_PAUSE_THRESHOLD);
    } else {
      setRawSegments([]);
    }
  };

  // ── 调整停顿阈值 → 重新分割 ──
  const handleThresholdChange = (newThreshold: number) => {
    setPauseThreshold(newThreshold);
    if (rawSegments.length > 0) {
      const newPairs = groupSegmentsByPause(rawSegments, newThreshold);
      setCurrentQAPairs(newPairs);
    }
  };

  // ── 保存到本地存储 ──
  const handleSave = () => {
    if (!recording) return;

    const text = isEditing ? editingText : recording.transcription;
    if (!text && currentQAPairs.length === 0) return;

    const record: SavedTranscription = {
      id: recording.id,
      filename: recording.filename,
      text: text || '',
      fileSize: recording.fileSize,
      fileType: recording.fileType,
      duration: recording.duration,
      createdAt: new Date().toISOString(),
      report,
      qaPairs: currentQAPairs,
      segments: rawSegments.length > 0 ? rawSegments : undefined,
    };

    const updated = [record, ...savedRecords.filter(r => r.id !== record.id)].slice(0, 50);
    setSavedRecords(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // 同步更新 recording
    setRecording({ ...recording, transcription: text, qaPairs: currentQAPairs });
    if (isEditing) setIsEditing(false);
  };

  // ── AI 面试复盘分析 ──
  const handleAnalyze = async () => {
    // 优先用 Q&A 结构化文本
    const text = currentQAPairs.length > 0
      ? currentQAPairs.map((pair, i) =>
          `Q${i + 1}: ${pair.question || '(问题)'}\nA${i + 1}: ${pair.answer}`
        ).join('\n\n')
      : (isEditing ? editingText : recording?.transcription);

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
          rec.id === recording.id ? { ...rec, report: r, qaPairs: currentQAPairs } : rec
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
    const text = currentQAPairs.length > 0
      ? formatQAPairsForExport(currentQAPairs, recording?.filename || '面试复盘')
      : (recording?.transcription || '');
    navigator.clipboard.writeText(text).then(() => {
      // 简单反馈
      const btn = document.activeElement as HTMLElement;
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '已复制 ✓';
        setTimeout(() => { btn.textContent = orig; }, 1500);
      }
    }).catch(() => alert('复制失败，请手动全选复制'));
  };

  // ── 下载为 TXT ──
  const handleDownload = () => {
    const text = currentQAPairs.length > 0
      ? formatQAPairsForExport(currentQAPairs, recording?.filename || '面试复盘')
      : (isEditing ? editingText : recording?.transcription);
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
      setCurrentQAPairs([]);
      setRawSegments([]);
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
      qaPairs: rec.qaPairs,
      segments: rec.segments,
    };
    setRecording(rf);
    setEditingText(rec.text);
    setIsEditing(false);
    setReport(rec.report || null);
    setCurrentQAPairs(rec.qaPairs || []);
    setRawSegments(rec.segments || []);
    if (rec.segments && rec.segments.length > 0) {
      setPauseThreshold(DEFAULT_PAUSE_THRESHOLD);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ═══ 标题栏 ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">面试复盘</h1>
          <p className="text-gray-500 text-sm mt-1">
            上传面试录音/视频，AI 语音转文字 · 根据停顿自动分割为问答文档
          </p>
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

      {/* ═══ 停顿阈值调节 ═══ */}
      {currentQAPairs.length > 0 && rawSegments.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-4">
          <SlidersHorizontal className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex-1 flex items-center gap-3">
            <span className="text-xs text-gray-500 shrink-0">停顿阈值</span>
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={pauseThreshold}
              onChange={e => handleThresholdChange(parseFloat(e.target.value))}
              className="flex-1 h-1.5 accent-blue-500"
            />
            <span className="text-sm font-mono font-medium text-gray-700 w-10 text-right shrink-0">
              {pauseThreshold}s
            </span>
          </div>
          <span className="text-xs text-gray-400 shrink-0">
            {currentQAPairs.length} 段
          </span>
        </div>
      )}

      {/* ═══ Q&A 编辑器 / 原始文本切换 ═══ */}
      {recording?.transcription && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {isEditing ? '原始转写文字' : '问答编辑'}
              {!isEditing && currentQAPairs.length > 0 && (
                <span className="text-sm font-normal text-gray-400">
                  ({currentQAPairs.length} 个问答对)
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!isEditing) {
                    // 切换到原始文本：把当前 QA 文本写回 editingText
                    const text = currentQAPairs.length > 0
                      ? formatQAPairsForExport(currentQAPairs, recording.filename)
                      : recording.transcription || '';
                    setEditingText(text);
                  }
                  setIsEditing(!isEditing);
                }}
              >
                {isEditing ? (
                  <><FileText className="w-3 h-3 mr-1" />问答视图</>
                ) : (
                  <><Edit3 className="w-3 h-3 mr-1" />原始文本</>
                )}
              </Button>
            </div>
          </div>

          {isEditing ? (
            /* 原始文本编辑（降级模式） */
            <div className="space-y-2">
              <Textarea
                className="min-h-[200px] font-mono text-sm"
                value={editingText}
                onChange={e => setEditingText(e.target.value)}
                placeholder="编辑转写文字..."
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                  <X className="w-3 h-3 mr-1" />返回问答视图
                </Button>
                <Button size="sm" onClick={handleSave}>
                  <Save className="w-3 h-3 mr-1" />保存
                </Button>
              </div>
            </div>
          ) : (
            /* Q&A 编辑器（主视图） */
            <QAPairEditor
              qaPairs={currentQAPairs}
              onChange={setCurrentQAPairs}
            />
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleSave} size="sm">
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
                      {r.qaPairs && r.qaPairs.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-4">
                          {r.qaPairs.length} QA对
                        </Badge>
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
