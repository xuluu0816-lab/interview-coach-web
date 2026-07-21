/**
 * 语音转文字服务 — 多层级降级
 * ───────────────────────────────────────────
 * 优先调用 Groq 免费 Whisper API（需 VITE_GROQ_API_KEY），
 * 降级走 Render 后端中转，最终兜底手动输入。
 *
 * Groq 免费额度：14,400 次/天，14,400 秒音频/天
 * API 文档：https://console.groq.com/docs/speech-text
 */

const GROQ_API = 'https://api.groq.com/openai/v1/audio/transcriptions';

const SUPPORTED_AUDIO = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/ogg', 'audio/x-m4a', 'audio/mp4', 'audio/webm',
  'audio/flac', 'audio/aac',
]);
const SUPPORTED_VIDEO = new Set([
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
]);

export function isAudioFile(file: File): boolean {
  return SUPPORTED_AUDIO.has(file.type) ||
    /\.(mp3|wav|m4a|ogg|flac|aac|wma|opus)$/i.test(file.name);
}

export function isVideoFile(file: File): boolean {
  return SUPPORTED_VIDEO.has(file.type) ||
    /\.(mp4|webm|mov|avi|mkv)$/i.test(file.name);
}

export function isMediaFile(file: File): boolean {
  return isAudioFile(file) || isVideoFile(file);
}

/** 格式化文件大小 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

/**
 * 从本地存储读取 Groq API Key
 */
function getGroqKey(): string {
  try {
    // @ts-ignore Vite env var
    return import.meta.env.VITE_GROQ_API_KEY || '';
  } catch {
    return '';
  }
}

export interface TranscribeResult {
  text: string;
  duration?: number;
  provider: 'groq' | 'manual';
  error?: string;
}

/**
 * 调用 Groq Whisper API 转写音频
 * 注意：Groq 限制文件最大 25MB，超过需先压缩
 */
async function groqTranscribe(file: File): Promise<TranscribeResult> {
  const key = getGroqKey();
  if (!key) throw new Error('GROQ_KEY_MISSING');

  if (file.size > 25 * 1024 * 1024) {
    throw new Error(`文件过大 (${formatSize(file.size)})，Groq 限制 25MB，请尝试压缩或裁剪音频`);
  }

  const fd = new FormData();
  fd.append('file', file);
  fd.append('model', 'whisper-large-v3');
  // 中文为主，自动检测
  fd.append('language', 'zh');
  fd.append('response_format', 'json');
  fd.append('temperature', '0');

  const res = await fetch(GROQ_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: fd,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
    throw new Error((err as any).error?.message || `Groq API 返回 ${res.status}`);
  }

  const data = await res.json() as any;
  return {
    text: data.text?.trim() || '',
    duration: data.duration,
    provider: 'groq',
  };
}

/**
 * 语音转文字主入口
 *
 * @param file  音频/视频文件
 * @param onProgress  进度回调 (0-100)
 * @returns 转写结果
 */
export async function transcribe(
  file: File,
  onProgress?: (pct: number, msg: string) => void,
): Promise<TranscribeResult> {
  // 1. 检验文件类型
  if (!isMediaFile(file)) {
    throw new Error(`不支持的音频格式: ${file.type || file.name}`);
  }

  onProgress?.(10, '正在准备转写...');

  // 2. 尝试 Groq 直连（最快，免费）
  const groqKey = getGroqKey();
  if (groqKey) {
    try {
      onProgress?.(20, '正在调用 Groq Whisper 引擎...');
      const result = await groqTranscribe(file);
      onProgress?.(100, '转写完成');
      return result;
    } catch (err: any) {
      console.warn('Groq 转写失败:', err.message);
      // 如果不是 KEY 缺失，继续尝试降级
      if (err.message === 'GROQ_KEY_MISSING') {
        // 没有配置 Key，跳过 Groq
      }
      // 其他错误也跳过，走手动输入
    }
  }

  // 3. 降级：提示手动输入
  onProgress?.(100, '需手动输入');
  return {
    text: '',
    provider: 'manual',
    error: groqKey
      ? '自动转写失败，请在下方文本框中手动粘贴对话内容'
      : '未配置语音转写服务，请在下方文本框中手动粘贴对话内容',
  };
}
