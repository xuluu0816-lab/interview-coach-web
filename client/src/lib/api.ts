/**
 * API 请求封装
 * 自动检测环境：开发环境用 proxy，生产环境用环境变量指定的后端地址
 */
import type {
  Session, InterviewQuestion, QuestionBankItem, UploadedFile,
  ReviewReport, ProgressReport, Application, ResumeAnalysis, JdAnalysis,
} from '@/types';

// 生产环境从环境变量读取，开发环境使用 Vite proxy
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ========== 基础 fetch 封装 ==========

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// ========== 认证 ==========

export async function login(email: string): Promise<{ token: string; user: any; isNew?: boolean }> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

// ========== 会话管理 ==========

export async function createSession(data: {
  company?: string;
  role?: string;
  level?: string;
}): Promise<Session> {
  return request('/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getSessions(): Promise<Session[]> {
  return request('/sessions');
}

export async function getSession(id: string): Promise<Session & { questions: InterviewQuestion[] }> {
  return request(`/sessions/${id}`);
}

export async function deleteSession(id: string): Promise<void> {
  return request(`/sessions/${id}`, { method: 'DELETE' });
}

// ========== 面试对话（SSE streaming） ==========

export function streamChat(
  sessionId: string,
  action: string,
  message: string,
  onToken: (text: string) => void,
  onEvent: (type: string, data: any) => void,
  onError: (err: Error) => void,
  onDone: () => void
): AbortController {
  const controller = new AbortController();
  const token = localStorage.getItem('token');

  fetch(`${BASE_URL}/sessions/${sessionId}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, message }),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'SSE connection failed' }));
      onError(new Error(err.message));
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) { onError(new Error('No stream')); return; }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const lines = part.split('\n');
        let eventType = '';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) eventType = line.slice(7);
          if (line.startsWith('data: ')) eventData = line.slice(6);
        }

        if (eventType && eventData) {
          try {
            const data = JSON.parse(eventData);
            if (eventType === 'token' && data.text) onToken(data.text);
            onEvent(eventType, data);
          } catch { /* skip */ }
        }
      }
    }
    onDone();
  }).catch((err) => {
    if (err.name !== 'AbortError') onError(err);
  });

  return controller;
}

// ========== 复盘 ==========

export async function generateReview(sessionId: string): Promise<ReviewReport> {
  return request(`/sessions/${sessionId}/review`, { method: 'POST' });
}

export async function completeSession(sessionId: string): Promise<Session> {
  return request(`/sessions/${sessionId}/complete`, { method: 'POST' });
}

// ========== 题库 ==========

export async function getQuestions(params?: {
  category?: string;
  difficulty?: string;
}): Promise<QuestionBankItem[]> {
  const search = new URLSearchParams();
  if (params?.category) search.set('category', params.category);
  if (params?.difficulty) search.set('difficulty', params.difficulty);
  const qs = search.toString();
  return request(`/questions${qs ? `?${qs}` : ''}`);
}

// ========== 进度 ==========

export async function getProgress(): Promise<ProgressReport> {
  return request('/progress');
}

// ========== 文件 ==========

export async function uploadFile(file: File): Promise<UploadedFile> {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE_URL}/files/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(err.message);
  }

  return res.json();
}

export async function getFiles(): Promise<UploadedFile[]> {
  return request('/files');
}

export async function getFileDetail(id: string): Promise<UploadedFile> {
  return request(`/files/${id}`);
}

export async function analyzeFile(
  id: string,
  analysisType: 'resume' | 'jd'
): Promise<{ type: string; result: ResumeAnalysis | JdAnalysis }> {
  return request(`/files/${id}/analyze`, {
    method: 'POST',
    body: JSON.stringify({ analysis_type: analysisType }),
  });
}

export async function deleteFile(id: string): Promise<void> {
  return request(`/files/${id}`, { method: 'DELETE' });
}

// ========== 投递记录 ==========

export async function getApplications(): Promise<Application[]> {
  return request('/applications');
}

export async function createApplication(data: {
  company: string;
  position: string;
  city?: string;
  applied_at?: string;
  status?: string;
  notes?: string;
  url?: string;
}): Promise<Application> {
  return request('/applications', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateApplication(id: string, data: Partial<Application>): Promise<Application> {
  return request(`/applications/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteApplication(id: string): Promise<void> {
  return request(`/applications/${id}`, { method: 'DELETE' });
}

export async function getAppStats(): Promise<{
  total: number;
  by_status: Record<string, number>;
  by_company: Record<string, number>;
  pass_rate: number;
  offer_count: number;
}> {
  return request('/applications/stats');
}
