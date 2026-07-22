/**
 * 智谱 AI (GLM) 客户端 — 多模态 + 文本简历解析
 *
 * GLM-4V-Flash：免费多模态模型，支持图片直传解析
 * GLM-4-Flash：免费文本模型，用于 PDF/Word 提取后的结构化整理
 *
 * 获取 API Key: https://open.bigmodel.cn/usercenter/apikeys
 */
import fs from 'fs';
import path from 'path';
import { config } from '../../config';

const ZHIPU_API = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

interface VisionMessage {
  role: 'user';
  content: (TextBlock | ImageBlock)[];
}

interface TextBlock {
  type: 'text';
  text: string;
}

interface ImageBlock {
  type: 'image_url';
  image_url: { url: string };
}

/**
 * 用智谱 GLM-4V 多模态直接解析图片简历
 * PDF/Word 先用 pdf-parse/mammoth 提取文本，再交 GLM-4 整理
 */
export async function parseResumeWithZhipu(
  filePath: string,
  filename: string,
  mimeType: string,
): Promise<string> {
  const apiKey = config.zhipu.apiKey;
  if (!apiKey) {
    throw new Error('ZHIPU_API_KEY 未配置，请在 Render 环境变量中添加（免费获取: https://open.bigmodel.cn/usercenter/apikeys）');
  }

  const ext = path.extname(filename).toLowerCase();
  let messages: { role: string; content: any }[];
  let model: string;

  // ── 图片：直传 GLM-4V ──
  if (['.png', '.jpg', '.jpeg'].includes(ext)) {
    const base64 = fs.readFileSync(filePath).toString('base64');
    model = config.zhipu.visionModel;
    messages = [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64}` },
        },
        {
          type: 'text',
          text: `请仔细识别并提取这份简历图片中的所有文字内容。
要求：
1. 保留原文结构和层级（教育经历、工作经历、项目经验、技能等）
2. 保留所有关键信息：姓名、联系方式、学校、公司、职位、时间、数字
3. 忠实提取，不要总结或评价
4. 直接输出纯文本简历内容`,
        },
      ],
    }];
  }
  // ── PDF：pdf-parse 提取文本 → GLM-4 整理 ──
  else if (ext === '.pdf') {
    const rawText = await extractPdfText(filePath);
    model = config.zhipu.textModel;
    messages = [{
      role: 'user',
      content: `以下是从 PDF 简历中提取的原始文本，请整理为结构清晰的简历内容（保留所有关键信息，去除页码、页眉页脚等噪声）：

${rawText}`,
    }];
  }
  // ── Word：mammoth 提取文本 → GLM-4 整理 ──
  else if (['.docx', '.doc'].includes(ext)) {
    const rawText = await extractDocxText(filePath);
    model = config.zhipu.textModel;
    messages = [{
      role: 'user',
      content: `以下是从 Word 简历中提取的原始文本，请整理为结构清晰的简历内容（保留所有关键信息）：

${rawText}`,
    }];
  } else {
    throw new Error(`不支持的文件格式: ${ext}`);
  }

  // 调用智谱 API
  const response = await fetch(ZHIPU_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as any;
    const msg = err?.error?.message || err?.message || `HTTP ${response.status}`;
    throw new Error(`智谱 API 解析失败: ${msg}`);
  }

  const data = await response.json() as any;
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new Error('智谱未返回有效文本');

  return text.trim();
}

// ── PDF 文本提取 ──
async function extractPdfText(filePath: string): Promise<string> {
  try {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || '(PDF 无文本内容)';
  } catch (err: any) {
    if (err.message?.includes('Cannot find module')) {
      throw new Error('pdf-parse 未安装');
    }
    throw new Error(`PDF 解析失败: ${err.message}`);
  }
}

// ── Word 文本提取 ──
async function extractDocxText(filePath: string): Promise<string> {
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '(Word 文档无文本内容)';
  } catch (err: any) {
    if (err.message?.includes('Cannot find module')) {
      throw new Error('mammoth 未安装');
    }
    throw new Error(`Word 解析失败: ${err.message}`);
  }
}
