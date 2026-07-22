/**
 * API 请求封装
 */
import type { Session, InterviewQuestion, QuestionBankItem, UploadedFile, ReviewReport, ProgressReport, Application, ResumeAnalysis, JdAnalysis, ApplicationV2, JdPrepResult, ExternalJob } from '@/types';

export const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options?.headers as Record<string, string> || {}) };
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) { const err = await res.json().catch(() => ({ message: 'Request failed' })); throw new Error(err.message || `HTTP ${res.status}`); }
  return res.json();
}

// ========== 认证 ==========
export async function login(email: string): Promise<{ token: string; user: any; isNew?: boolean }> { return request('/auth/login', { method: 'POST', body: JSON.stringify({ email }) }); }

// ========== 会话管理 ==========
export async function createSession(data: { company?: string; role?: string; level?: string; jdText?: string; resumeText?: string }): Promise<Session> { return request('/sessions', { method: 'POST', body: JSON.stringify(data) }); }
export async function getSessions(): Promise<Session[]> { return request('/sessions'); }
export async function getSession(id: string): Promise<Session & { questions: InterviewQuestion[] }> { return request(`/sessions/${id}`); }
export async function deleteSession(id: string): Promise<void> { return request(`/sessions/${id}`, { method: 'DELETE' }); }

// ========== 面试对话 SSE ==========
export function streamChat(sessionId: string, action: string, message: string, onToken: (text: string) => void, onEvent: (type: string, data: any) => void, onError: (err: Error) => void, onDone: () => void): AbortController {
  const controller = new AbortController(); const token = localStorage.getItem('token');
  fetch(`${BASE_URL}/sessions/${sessionId}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action, message }), signal: controller.signal })
    .then(async res => {
      if (!res.ok) { onError(new Error((await res.json().catch(() => ({ message: 'SSE failed' }))).message)); return; }
      const reader = res.body?.getReader(); if (!reader) { onError(new Error('No stream')); return; }
      const decoder = new TextDecoder(); let buffer = '';
      while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const parts = buffer.split('\n\n'); buffer = parts.pop() || ''; for (const part of parts) { const lines = part.split('\n'); let et = ''; let ed = ''; for (const line of lines) { if (line.startsWith('event: ')) et = line.slice(7); if (line.startsWith('data: ')) ed = line.slice(6); } if (et && ed) { try { const d = JSON.parse(ed); if (et === 'token' && d.text) onToken(d.text); onEvent(et, d); } catch { /* skip */ } } } }
      onDone();
    }).catch(err => { if (err.name !== 'AbortError') onError(err); });
  return controller;
}

// ========== 复盘 ==========
export async function generateReview(sessionId: string): Promise<ReviewReport> { return request(`/sessions/${sessionId}/review`, { method: 'POST' }); }
export async function completeSession(sessionId: string): Promise<Session> { return request(`/sessions/${sessionId}/complete`, { method: 'POST' }); }

// ========== 题库 ==========
export async function getQuestions(params?: { category?: string; difficulty?: string }): Promise<QuestionBankItem[]> { const s = new URLSearchParams(); if (params?.category) s.set('category', params.category); if (params?.difficulty) s.set('difficulty', params.difficulty); const qs = s.toString(); return request(`/questions${qs ? `?${qs}` : ''}`); }

// ========== 进度 ==========
export async function getProgress(): Promise<ProgressReport> { return request('/progress'); }

// ========== 文件 ==========
export async function uploadFile(file: File): Promise<UploadedFile> { const token = localStorage.getItem('token'); const fd = new FormData(); fd.append('file', file); const res = await fetch(`${BASE_URL}/files/upload`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd }); if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Upload failed' }))).message); return res.json(); }
// ── 面试准备模块：两步式上传 → 缓存 → 确认 → AI 解析 ──

/** 上传简历文件 → 后端本地解析 + 缓存（不返回文本） */
export async function prepResumeFile(file: File): Promise<{ id: string; filename: string; file_type: string }> {
  const token = localStorage.getItem('token');
  const fd = new FormData(); fd.append('file', file);
  const res = await fetch(`${BASE_URL}/files/prep-resume`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ message: '上传失败' }))).message);
  return res.json();
}

/** 上传 JD 文件 → 后端本地解析 + 缓存（不返回文本） */
export async function prepJDFile(file: File): Promise<{ id: string; filename: string; file_type: string }> {
  const token = localStorage.getItem('token');
  const fd = new FormData(); fd.append('file', file);
  const res = await fetch(`${BASE_URL}/files/prep-jd`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ message: '上传失败' }))).message);
  return res.json();
}

/** 缓存纯文本（JD/简历手动粘贴场景） */
export async function cacheText(text: string, type: 'jd' | 'resume'): Promise<{ id: string }> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE_URL}/files/cache-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ text, type }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ message: '缓存失败' }))).message);
  return res.json();
}

/** 确认后调用智谱 AI 解析缓存的文本 */
export async function confirmPrep(id: string, type: 'resume' | 'jd'): Promise<{ text: string }> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE_URL}/files/${id}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ type }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'AI 解析失败' }))).message);
  return res.json();
}
export async function getFiles(): Promise<UploadedFile[]> { return request('/files'); }
export async function getFileDetail(id: string): Promise<UploadedFile> { return request(`/files/${id}`); }
export async function analyzeFile(id: string, analysisType: 'resume' | 'jd'): Promise<{ type: string; result: ResumeAnalysis | JdAnalysis }> { return request(`/files/${id}/analyze`, { method: 'POST', body: JSON.stringify({ analysis_type: analysisType }) }); }
export async function deleteFile(id: string): Promise<void> { return request(`/files/${id}`, { method: 'DELETE' }); }

// ========== 投递记录 ==========
export async function getApplications(): Promise<ApplicationV2[]> { return request('/applications'); }
export async function createApplicationV2(data: { company: string; position: string; city?: string; appliedAt?: string; notes?: string; url?: string; stages?: any[]; currentStage?: string }): Promise<ApplicationV2> { return request('/applications', { method: 'POST', body: JSON.stringify({ ...data, status: 'resume_screening' }) }); }
export async function updateApplication(id: string, data: Partial<ApplicationV2>): Promise<ApplicationV2> { return request(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function updateApplicationStage(id: string, stage: string, info: Record<string, any>): Promise<ApplicationV2> { return request(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify({ currentStage: stage, stageInfo: info }) }); }
export async function deleteApplication(id: string): Promise<void> { return request(`/applications/${id}`, { method: 'DELETE' }); }
export async function getAppStats(): Promise<{ total: number; by_status: Record<string, number>; pass_rate: number; offer_count: number }> { return request('/applications/stats'); }

// ========== 岗位 ==========
export async function saveJob(id: string): Promise<void> { return request(`/jobs/${id}/save`, { method: 'POST' }); }
export async function unsaveJob(id: string): Promise<void> { return request(`/jobs/${id}/save`, { method: 'DELETE' }); }

// ===== 模块1: JD预习 — 上传文件 + 自定义 prompt =====

/**
 * JD 预习分析（文件上传模式）
 * - fileId: prepJDFile 返回的缓存 ID
 * - prompt: 用户自定义分析要求（如"请重点分析技术栈"），可选
 * 后端直接读取缓存文本调用 AI，不经过前端
 */
export async function analyzeJDPrep(fileId: string, prompt?: string): Promise<JdPrepResult> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE_URL}/analyze/jd-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ fileId, prompt: prompt?.trim() || undefined }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'JD分析失败' }))).message);
  return res.json();
}

// ===== 模块4: 外部岗位拉取（CORS代理 → 缓存 → 静态JSON三级降级） =====
export { fetchJobsFromExternal, getCachedJobs } from './jobFetcher';
export type { FetchJobsResult, JobBoardCache } from './jobFetcher';
