/**
 * Google Gemini API 客户端 — 多模态文件解析（免费）
 *
 * Gemini 2.5 Flash 免费额度：15 RPM / 1,500 RPD
 * 支持直接解析 PNG/JPG/PDF（无需 OCR）。
 * .docx 文件由 mammoth 提取文本后传入。
 *
 * 获取 API Key: https://aistudio.google.com/apikey
 */
import fs from 'fs';
import path from 'path';
import { config } from '../../config';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';

interface InlineDataPart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

interface TextPart {
  text: string;
}

type GeminiPart = TextPart | InlineDataPart;

/**
 * 用 Gemini 多模态能力直接解析简历文件
 *
 * @param filePath  服务器上的文件路径
 * @param filename  原始文件名（用于判断类型）
 * @param mimeType  文件 MIME 类型
 * @returns 解析后的纯文本简历内容
 */
export async function parseResumeWithGemini(
  filePath: string,
  filename: string,
  mimeType: string,
): Promise<string> {
  const apiKey = config.gemini.apiKey;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 未配置，请在 Render 环境变量中添加（免费获取: https://aistudio.google.com/apikey）');
  }

  const fileBuffer = fs.readFileSync(filePath);
  const base64Data = fileBuffer.toString('base64');
  const ext = path.extname(filename).toLowerCase();

  const parts: GeminiPart[] = [];
  let fileLabel = '';

  // 根据文件类型添加对应的视觉块
  if (['.png', '.jpg', '.jpeg'].includes(ext)) {
    parts.push({ inlineData: { mimeType, data: base64Data } });
    fileLabel = '图片';
  } else if (ext === '.pdf') {
    parts.push({ inlineData: { mimeType: 'application/pdf', data: base64Data } });
    fileLabel = 'PDF';
  } else if (['.docx', '.doc'].includes(ext)) {
    // Word 文档：mammoth 提取文本
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      parts.push({ text: `以下是从 Word 文档中提取的简历内容，请直接解析：\n\n${result.value || '(空文档)'}` });
      fileLabel = 'Word';
    } catch (err: any) {
      if (err.message?.includes('Cannot find module')) {
        throw new Error('mammoth 未安装，请运行: npm install mammoth');
      }
      throw err;
    }
  } else {
    throw new Error(`不支持的文件格式: ${ext}`);
  }

  // 添加解析指令
  parts.push({
    text: `请仔细阅读这份${fileLabel}简历文件，将其中所有文字内容完整提取出来。

要求：
1. 保留原文结构和层级（教育经历、工作经历、项目经验、技能等）
2. 保留所有关键信息：姓名、联系方式、学校、公司、职位、时间、数字等
3. 不要总结或概括，不要添加你的评价——只做忠实提取
4. ${fileLabel === '图片' ? '请逐行识别并转录图片中的文字' : '保留原文结构'}
5. 直接输出纯文本简历内容，不要加任何前言后语`,
  });

  // 调用 Gemini API
  const url = `${GEMINI_API}/${config.gemini.model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: config.gemini.maxTokens,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as any;
    const msg = err?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gemini API 解析失败: ${msg}`);
  }

  const data = await response.json() as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!text.trim()) {
    // 检查是否有安全过滤导致空响应
    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY') {
      throw new Error('Gemini 内容安全过滤拦截，请确认文件不含敏感信息');
    }
    throw new Error('Gemini 未返回有效文本，请重试');
  }

  return text.trim();
}
