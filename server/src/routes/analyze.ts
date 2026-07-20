/**
 * 文本分析路由 — POST /api/analyze/text
 * 直接传入文本进行 JD预习/简历/JD分析
 */
import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';
import { chatJSON } from '../services/ai/client';
import { SYSTEM_PERSONA, RESUME_ANALYZER_PROMPT, JD_ANALYZER_PROMPT } from '../services/ai/prompts';

const router = Router();
router.use(optionalAuth);

router.post('/text', async (req: Request, res: Response) => {
  const { text, analysis_type } = req.body as { text: string; analysis_type: string };
  if (!text?.trim()) return res.status(400).json({ error: true, message: '文本内容不能为空' });

  try {
    if (analysis_type === 'jd_prep') {
      const result = await chatJSON<any>([
        { role: 'system', content: SYSTEM_PERSONA },
        { role: 'user', content: `作为资深面试教练，分析以下岗位JD，生成面试预习材料。\n## JD内容\n${text}\n\n输出JSON：{"companyFramework":{"overview":"","businessLines":[],"competitors":[],"recentNews":[],"culture":"","interviewStyle":""},"businessQuestions":[{"id":"q1","scenario":"","question":"","category":"","referenceAnswer":""}]}。businessQuestions至少10题，覆盖BQ/产品设计/数据分析/估算/CASE。输出纯JSON不含markdown。` },
      ], { temperature: 0.3, maxTokens: 4096 });
      return res.json(result);
    }
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

export default router;
