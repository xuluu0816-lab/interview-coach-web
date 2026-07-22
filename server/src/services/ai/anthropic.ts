/**
 * Anthropic Claude API 客户端 — 多模态文件解析
 *
 * 支持直接解析 PNG/JPG/PDF（无需 OCR/文字提取中间步骤）。
 * Claude 直接"看"文件图片/PDF，提取简历信息。
 * .docx 文件由 mammoth 提取文本后传入 Claude。
 */
import fs from 'fs';
import path from 'path';
import { config } from '../../config';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

interface ContentBlock {
  type: 'text' | 'image' | 'document';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

/**
 * 用 Claude 多模态能力直接解析简历文件
 *
 * @param filePath  服务器上的文件路径
 * @param filename  原始文件名（用于判断类型）
 * @param mimeType  文件 MIME 类型
 * @returns 解析后的纯文本简历内容
 */
export async function parseResumeWithClaude(
  filePath: string,
  filename: string,
  mimeType: string,
): Promise<string> {
  const apiKey = config.anthropic.apiKey;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 未配置，无法使用 Claude 解析文件');
  }

  const fileBuffer = fs.readFileSync(filePath);
  const base64Data = fileBuffer.toString('base64');
  const ext = path.extname(filename).toLowerCase();

  // 构建多模态内容块
  const content: ContentBlock[] = [];

  // 根据文件类型添加对应的视觉块
  if (['.png', '.jpg', '.jpeg'].includes(ext)) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mimeType,
        data: base64Data,
      },
    });
  } else if (ext === '.pdf') {
    content.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: base64Data,
      },
    });
  } else if (['.docx', '.doc'].includes(ext)) {
    // Word 文档：用 mammoth 提取文本后传给 Claude
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      content.push({
        type: 'text',
        text: `以下是从 Word 文档中提取的简历内容，请直接解析：\n\n${result.value || '(空文档)'}`,
      });
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
  content.push({
    type: 'text',
    text: `请仔细阅读这份简历文件，将其中所有文字内容完整提取出来。

要求：
1. 保留原文结构和层级（教育经历、工作经历、项目经验、技能等）
2. 保留所有关键信息：姓名、联系方式、学校、公司、职位、时间、数字等
3. 不要总结或概括，不要添加你的评价——只做忠实提取
4. 如果文件是图片，请逐行识别并转录；如果是PDF，保留页面结构
5. 输出纯文本格式，方便直接作为简历内容使用`,
  });

  // 调用 Claude API
  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: config.anthropic.model,
      max_tokens: config.anthropic.maxTokens,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as any;
    const msg = err?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Claude API 解析失败: ${msg}`);
  }

  const data = await response.json() as any;
  const text = data?.content?.[0]?.text || '';
  if (!text.trim()) throw new Error('Claude 未返回有效文本');

  return text.trim();
}
