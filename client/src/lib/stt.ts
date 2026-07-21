/**
 * 语音转文字服务 — 多层级降级 + 停顿分割
 * ───────────────────────────────────────────
 * 优先调用 Groq 免费 Whisper API（需 VITE_GROQ_API_KEY），
 * 降级走 Render 后端中转，最终兜底手动输入。
 *
 * Groq 免费额度：14,400 次/天，14,400 秒音频/天
 * API 文档：https://console.groq.com/docs/speech-text
 *
 * v2: 新增 verbose_json + timestamp_granularities 支持，
 *     通过语音段间隔检测停顿，自动将转写文字拆分为多段答案。
 */

import type { QAPair } from '@/types';

const GROQ_API = 'https://api.groq.com/openai/v1/audio/transcriptions';

/** 默认停顿阈值（秒）—— 两段语音间隔超过此值则视为新答案段落 */
export const DEFAULT_PAUSE_THRESHOLD = 2.5;

/** 最长大间隔（秒）—— 超过此值视为录音中断而非新问题 */
const MAX_GAP = 30;

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

// ── Whisper Segment 类型 ──

export interface WhisperSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

// ── TranscribeResult ──

export interface TranscribeResult {
  text: string;
  duration?: number;
  provider: 'groq' | 'manual';
  error?: string;
  segments?: WhisperSegment[];
}

/**
 * 调用 Groq Whisper API 转写音频（verbose_json 模式，含段落时间戳）
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
  fd.append('language', 'zh');
  fd.append('response_format', 'verbose_json');
  fd.append('timestamp_granularities', 'segment');
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
  const rawSegments: WhisperSegment[] = data.segments || [];

  return {
    text: data.text?.trim() || '',
    duration: data.duration,
    provider: 'groq',
    segments: rawSegments,
  };
}

/**
 * 根据语音停顿将 Whisper 段落分组为多个答案
 *
 * 算法：
 * 1. 按时序排列段落
 * 2. 过滤低置信度段落（no_speech_prob > 0.8）
 * 3. 相邻段落间隔 > pauseThreshold → 新答案组
 * 4. 间隔 > maxGap → 视为录音中断，继续当前组
 *
 * @param segments      Whisper 返回的段落数组
 * @param pauseThreshold 停顿阈值（秒），默认 2.5s
 * @returns QAPair 数组，每个元素 question 为空待用户填写
 */
export function groupSegmentsByPause(
  segments: WhisperSegment[],
  pauseThreshold: number = DEFAULT_PAUSE_THRESHOLD,
): QAPair[] {
  if (!segments || segments.length === 0) return [];

  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const groups: WhisperSegment[][] = [];
  let currentGroup: WhisperSegment[] = [];

  for (const seg of sorted) {
    // 跳过低置信度段落（可能是背景噪音）
    if (seg.no_speech_prob > 0.8) continue;

    if (currentGroup.length === 0) {
      currentGroup.push(seg);
    } else {
      const prev = currentGroup[currentGroup.length - 1];
      const gap = seg.start - prev.end;

      if (gap > MAX_GAP) {
        // 极长停顿：录音中断 → 提交当前组，开始新组
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
          currentGroup = [];
        }
        currentGroup.push(seg);
      } else if (gap >= pauseThreshold) {
        // 自然停顿 → 新答案段落
        groups.push(currentGroup);
        currentGroup = [seg];
      } else {
        // 连续说话 → 同一答案
        currentGroup.push(seg);
      }
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  // 转为 QAPair
  const ts = Date.now();
  return groups.map((group, i) => ({
    id: `qa_${ts}_${i}_${Math.random().toString(36).slice(2, 6)}`,
    question: '',
    answer: group.map(s => s.text.trim()).join(' ').trim(),
    startTime: group[0].start,
    endTime: group[group.length - 1].end,
  }));
}

/**
 * 语音转文字主入口
 *
 * @param file       音频/视频文件
 * @param onProgress 进度回调 (0-100, msg)
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
      // 降级：走手动输入
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
