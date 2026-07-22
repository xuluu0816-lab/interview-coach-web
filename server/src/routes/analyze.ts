/**
 * 文本分析路由 — POST /api/analyze/text  |  POST /api/analyze/jd-file
 * 支持直接传文本或通过缓存文件 ID 进行分析
 */
import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';
import { db, uploadedFiles } from '../db';
import { eq } from 'drizzle-orm';
import { chatJSON } from '../services/ai/client';
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

/** POST /jd-file — 通过缓存文件 ID 分析 JD（不暴露解析文本给前端） */
router.post('/jd-file', async (req: Request, res: Response) => {
  const { fileId, prompt } = req.body as { fileId?: string; prompt?: string };
  if (!fileId) return res.status(400).json({ error: true, message: '请提供 fileId' });

  const file = db().select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId)).all()[0] as any;
  if (!file) return res.status(404).json({ error: true, message: '文件不存在，请重新上传' });
  if (!file.parsed_text?.trim()) return res.status(400).json({ error: true, message: '文件解析内容为空，请重新上传' });

  try {
    return res.json(await runJDAnalysis(file.parsed_text, prompt));
  } catch (err: any) {
    return res.status(500).json({ error: true, message: `AI分析失败: ${err.message}` });
  }
});

export default router;
