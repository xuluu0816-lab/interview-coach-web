/**
 * 文本分析路由 — POST /api/analyze/text  |  POST /api/analyze/jd-file
 * 支持直接传文本或通过缓存文件 ID 进行分析
 *
 * 解析模型（与模拟面试简历上传一致）：
 * 本地解析(pdf-parse/mammoth/tesseract) → 智谱 GLM-4-Flash 结构化 → DeepSeek 深度分析
 */
import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';
import { db, uploadedFiles } from '../db';
import { eq } from 'drizzle-orm';
import { chatJSON } from '../services/ai/client';
import { parseJDWithAI } from '../services/ai/zhipu';
import { SYSTEM_PERSONA, RESUME_ANALYZER_PROMPT, JD_ANALYZER_PROMPT } from '../services/ai/prompts';

const router = Router();
router.use(optionalAuth);

/** JD 分析内部逻辑 */
async function runJDAnalysis(jdText: string, prompt?: string) {
  const extraInstruction = prompt?.trim()
    ? `\n\n用户补充分析要求（请优先满足以下要求）：${prompt.trim()}`
    : '';
  return chatJSON<any>([
    { role: 'system', content: SYSTEM_PERSONA },
    { role: 'user', content: `作为资深面试教练，分析以下岗位JD，生成面试预习材料。${extraInstruction}\n## JD内容\n${jdText}\n\n输出JSON：{"companyFramework":{"overview":"","businessLines":[],"competitors":[],"recentNews":[],"culture":"","interviewStyle":""},"businessQuestions":[{"id":"q1","scenario":"","question":"","category":"","referenceAnswer":""}]}。businessQuestions至少10题，覆盖BQ/产品设计/数据分析/估算/CASE。输出纯JSON不含markdown。` },
  ], { temperature: 0.3, maxTokens: 4096 });
}

/** POST /text — 直接传入文本分析 */
router.post('/text', async (req: Request, res: Response) => {
  const { text, analysis_type, prompt } = req.body as { text: string; analysis_type: string; prompt?: string };
  if (!text?.trim()) return res.status(400).json({ error: true, message: '文本内容不能为空' });

  try {
    if (analysis_type === 'jd_prep') return res.json(await runJDAnalysis(text, prompt));
    if (analysis_type === 'resume') {
      const result = await chatJSON<any>([{ role: 'system', content: SYSTEM_PERSONA }, { role: 'user', content: RESUME_ANALYZER_PROMPT(text) }], { temperature: 0.2 });
      return res.json(result);
    }
    if (analysis_type === 'jd') {
      const result = await chatJSON<any>([{ role: 'system', content: SYSTEM_PERSONA }, { role: 'user', content: JD_ANALYZER_PROMPT(text) }], { temperature: 0.2 });
      return res.json(result);
    }
    return res.status(400).json({ error: true, message: `不支持的分析类型: ${analysis_type}` });
  } catch (err: any) {
    return res.status(500).json({ error: true, message: `AI分析失败: ${err.message}` });
  }
});

/** POST /jd-file — 缓存文件 ID（支持多个）→ 智谱结构化 → DeepSeek 深度分析 */
router.post('/jd-file', async (req: Request, res: Response) => {
  const { fileId, fileIds, prompt } = req.body as { fileId?: string; fileIds?: string[]; prompt?: string };
  // 兼容单文件 fileId 或多文件 fileIds
  const ids = fileIds?.length ? fileIds : fileId ? [fileId] : [];
  if (ids.length === 0) return res.status(400).json({ error: true, message: '请提供 fileId 或 fileIds' });
  if (ids.length > 5) return res.status(400).json({ error: true, message: '最多上传 5 个文件' });

  // 读取所有缓存文本
  const texts: string[] = [];
  for (const id of ids) {
    const file = db().select().from(uploadedFiles).where(eq(uploadedFiles.id, id)).all()[0] as any;
    if (!file) return res.status(404).json({ error: true, message: `文件 ${id} 不存在，请重新上传` });
    if (!file.parsed_text?.trim()) return res.status(400).json({ error: true, message: `文件 ${file.filename} 解析内容为空，请重新上传` });
    texts.push(`### ${file.filename}\n${file.parsed_text}`);
  }

  try {
    // ① 合并后智谱 GLM-4-Flash 结构化
    const combinedText = texts.join('\n\n---\n\n');
    const structuredJD = await parseJDWithAI(combinedText);
    // ② DeepSeek 深度分析
    return res.json(await runJDAnalysis(structuredJD, prompt));
  } catch (err: any) {
    return res.status(500).json({ error: true, message: `AI分析失败: ${err.message}` });
  }
});

export default router;
