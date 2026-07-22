/**
 * 智谱 AI (GLM-4-Flash) 客户端 — 纯文本简历/JD 解析
 *
 * 流程：后端本地提取纯文本后，调用智谱文本模型进行结构化整理。
 * 不使用多模态 image_url 方案 —— 图片一律先经本地 tesseract.js OCR 提取文字。
 *
 * 获取 API Key: https://open.bigmodel.cn/usercenter/apikeys
 */
import { config } from '../../config';

const ZHIPU_API = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

/**
 * 调用智谱 GLM-4-Flash 文本模型
 */
async function callZhipu(messages: ChatMessage[], maxTokens = 4096): Promise<string> {
  const apiKey = config.zhipu.apiKey;
  if (!apiKey) {
    throw new Error(
      'ZHIPU_API_KEY 未配置，请在 Render 环境变量中添加（免费获取: https://open.bigmodel.cn/usercenter/apikeys）',
    );
  }

  const response = await fetch(ZHIPU_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.zhipu.model,
      messages,
      temperature: 0.1,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as any;
    const msg = err?.error?.message || err?.message || `HTTP ${response.status}`;
    throw new Error(`智谱 API 调用失败: ${msg}`);
  }

  const data = (await response.json()) as any;
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new Error('智谱未返回有效文本');

  return text.trim();
}

// ────────────────────────────────────────────────────────────────
// 简历：将本地提取的原始文本整理为结构化简历
// ────────────────────────────────────────────────────────────────

const RESUME_PARSE_SYSTEM = `你是一位专业的简历解析助手。你的任务是将从简历文件中提取的原始文本整理为结构清晰的简历内容。

要求：
1. 保留所有关键信息：姓名、联系方式、教育经历、工作经历、项目经验、技能、证书等
2. 忠实于原文内容，不要编造或推测任何信息
3. 如果原文某部分缺失（如无联系方式），直接跳过，不要填充占位符
4. 输出结构清晰的纯文本简历，每个部分用小标题标注
5. 去除页码、页眉页脚、乱码等提取噪声`;

export async function parseResumeWithAI(rawText: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: RESUME_PARSE_SYSTEM },
    {
      role: 'user',
      content: `请将以下从简历文件中提取的原始文本整理为结构化简历：\n\n${rawText}`,
    },
  ];
  return callZhipu(messages, 4096);
}

// ────────────────────────────────────────────────────────────────
// JD：将本地提取的原始文本整理为结构化岗位描述
// ────────────────────────────────────────────────────────────────

const JD_PARSE_SYSTEM = `你是一位专业的JD（岗位描述）解析助手。你的任务是将岗位描述文本整理为结构清晰的内容。

要求：
1. 提取关键信息：职位名称、公司、工作地点、薪资范围（如有）
2. 整理岗位职责（职责列表）
3. 整理任职要求（要求列表）
4. 保留技术栈、工具、证书等关键词
5. 忠实于原文，不要编造信息
6. 输出结构清晰的纯文本`;

export async function parseJDWithAI(rawText: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: JD_PARSE_SYSTEM },
    {
      role: 'user',
      content: `请将以下岗位描述整理为结构化内容：\n\n${rawText}`,
    },
  ];
  return callZhipu(messages, 4096);
}
