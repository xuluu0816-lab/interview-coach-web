import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { uploadFile, getFiles, getFileDetail, analyzeFile, deleteFile } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { UploadedFile, ResumeAnalysis, JdAnalysis } from '@/types';
import { Upload, FileText, Trash2, Loader2, Download, Eye } from 'lucide-react';

export default function FilesPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | JdAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const loadFiles = useCallback(async () => {
    try { setFiles(await getFiles()); } catch {}
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      await uploadFile(file);
      await loadFiles();
    } catch (err: any) {
      alert('上传失败：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (f: UploadedFile) => {
    setSelectedFile(f);
    setAnalysis(null);
    try {
      const detail = await getFileDetail(f.id);
      setSelectedFile(detail);
    } catch {}
  };

  const handleAnalyze = async (type: 'resume' | 'jd') => {
    if (!selectedFile) return;
    setAnalyzing(true);
    try {
      const result = await analyzeFile(selectedFile.id, type);
      setAnalysis(result.result as any);
    } catch (err: any) {
      alert('分析失败：' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除？')) return;
    await deleteFile(id);
    if (selectedFile?.id === id) { setSelectedFile(null); setAnalysis(null); }
    await loadFiles();
  };

  const fileIcons: Record<string, string> = {
    pdf: '📄', docx: '📝', txt: '📃', png: '🖼️', jpg: '🖼️', mp3: '🎵', mp4: '🎬',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">文件管理</h1>
          <p className="text-gray-500 mt-1">上传简历、JD、面经，AI 帮你分析提炼</p>
        </div>
        <label className="cursor-pointer">
          <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
            {loading ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />上传中...</span> : <span className="flex items-center gap-2"><Upload className="w-4 h-4" />上传文件</span>}
          </div>
          <input type="file" className="hidden" onChange={handleUpload}
            accept=".txt,.pdf,.docx,.doc,.png,.jpg,.jpeg,.mp3,.mp4" />
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 文件列表 */}
        <div className="lg:col-span-1 space-y-3">
          {files.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Upload className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">还没有上传文件</p>
            </div>
          )}
          {files.map(f => (
            <Card
              key={f.id}
              className={`cursor-pointer hover:shadow transition-shadow ${selectedFile?.id === f.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => handleSelect(f)}
            >
              <CardContent className="pt-4 flex items-center gap-3">
                <span className="text-2xl">{fileIcons[f.file_type] || '📎'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.filename}</p>
                  <p className="text-xs text-gray-400">{formatDate(f.created_at)}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); handleDelete(f.id); }}>
                  <Trash2 className="w-4 h-4 text-gray-400" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 文件详情 & 分析 */}
        <div className="lg:col-span-2">
          {!selectedFile ? (
            <div className="text-center py-24 text-gray-400 border rounded-lg">
              <Eye className="w-8 h-8 mx-auto mb-2" />
              <p>选择左侧文件查看详情</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{selectedFile.filename}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-4">
                    <Button size="sm" onClick={() => handleAnalyze('resume')} disabled={analyzing}>
                      {analyzing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                      解析简历
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleAnalyze('jd')} disabled={analyzing}>
                      解析JD
                    </Button>
                  </div>

                  {/* 简历分析结果 */}
                  {analysis && 'personal_info' in analysis && (
                    <ResumeAnalysisView analysis={analysis as ResumeAnalysis} />
                  )}

                  {/* JD 分析结果 */}
                  {analysis && 'core_requirements' in analysis && (
                    <JdAnalysisView analysis={analysis as JdAnalysis} />
                  )}

                  {/* 解析文本 */}
                  {!analysis && (
                    <div>
                      <p className="text-xs text-gray-400 mb-2">解析文本预览</p>
                      <pre className="text-sm text-gray-600 whitespace-pre-wrap max-h-96 overflow-y-auto bg-gray-50 p-4 rounded-lg">
                        {selectedFile.parsed_text_preview || selectedFile.parsed_text?.slice(0, 1000) || '暂无解析内容'}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResumeAnalysisView({ analysis }: { analysis: ResumeAnalysis }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-400 mb-1">个人信息</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(analysis.personal_info).map(([k, v]) =>
            v ? <Badge key={k} variant="secondary">{k}: {v}</Badge> : null
          )}
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">技能</p>
        <div className="flex flex-wrap gap-1">
          {analysis.skills.map((s, i) => <Badge key={i} variant="outline">{s}</Badge>)}
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">经历 ({analysis.experiences.length}条)</p>
        {analysis.experiences.map((exp, i) => (
          <div key={i} className="bg-gray-50 rounded p-3 mb-2">
            <p className="text-sm font-medium">{exp.role} @ {exp.company}</p>
            <p className="text-xs text-gray-400">{exp.duration}</p>
            {exp.highlights.map((h, j) => <p key={j} className="text-xs text-gray-600 mt-1">· {h}</p>)}
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">STAR面试素材 ({analysis.star_materials.length}条)</p>
        {analysis.star_materials.map((star, i) => (
          <div key={i} className="bg-blue-50 rounded p-3 mb-2">
            <p className="text-xs font-medium">可用于：{star.usable_for.join('、')}</p>
            <p className="text-xs text-gray-600 mt-1"><b>S:</b> {star.situation}</p>
            <p className="text-xs text-gray-600"><b>T:</b> {star.task}</p>
            <p className="text-xs text-gray-600"><b>A:</b> {star.action}</p>
            <p className="text-xs text-gray-600"><b>R:</b> {star.result}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function JdAnalysisView({ analysis }: { analysis: JdAnalysis }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-400 mb-1">核心要求</p>
        <ul className="list-disc list-inside">
          {analysis.core_requirements.map((r, i) => <li key={i} className="text-sm">{r}</li>)}
        </ul>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">能力检查清单</p>
        <div className="flex flex-wrap gap-1">
          {analysis.skill_checklist.map((s, i) => <Badge key={i} variant="secondary">{s}</Badge>)}
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">面试重点</p>
        <ul className="list-disc list-inside">
          {analysis.interview_focus.map((f, i) => <li key={i} className="text-sm">{f}</li>)}
        </ul>
      </div>
      <div className="bg-blue-50 rounded p-3">
        <p className="text-xs text-blue-600 font-medium">简历建议</p>
        <p className="text-sm mt-1">{analysis.resume_match_tips}</p>
      </div>
    </div>
  );
}
