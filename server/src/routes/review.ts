import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';
import { db, sessions, interviewQuestions } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { generateReviewReport } from '../services/ai/reviewer';
import { chatJSON } from '../services/ai/client';
import { REPORTER_GAP_PROMPT } from '../services/ai/prompts';

const router = Router();
router.use(optionalAuth);

router.post('/:id/review', async (req: Request, res: Response) => {
  const session = db().select().from(sessions).where(eq(sessions.id, req.params.id)).all()[0];
  if (!session) return res.status(404).json({ error: true, message: '会话不存在' });
  try {
    const report = await generateReviewReport(req.params.id);
    return res.json(report);
  } catch (err: any) {
    return res.status(500).json({ error: true, message: `生成报告失败: ${err.message}` });
  }
});

// ── MockInterview 风格差距报告 ──
router.post('/:id/gap-report', async (req: Request, res: Response) => {
  const session = db().select().from(sessions).where(eq(sessions.id, req.params.id)).all()[0];
  if (!session) return res.status(404).json({ error: true, message: '会话不存在' });

  try {
    const questions = db().select().from(interviewQuestions)
      .where(and(
        eq(interviewQuestions.session_id, req.params.id),
        sql`${interviewQuestions.user_answer} IS NOT NULL AND ${interviewQuestions.user_answer} != ''`
      ))
      .orderBy(sql`sequence ASC`).all();

    const completedQuestions = questions.map(q => {
      let confidence = 3; // 默认信心
      try {
        if (q.feedback) {
          const fb = JSON.parse(q.feedback);
          if (fb.confidence) confidence = fb.confidence;
        }
      } catch { /* ignore */ }

      return {
        question: q.question_text,
        dimension: `${q.category}${q.sub_category ? '-' + q.sub_category : ''}`,
        userAnswer: q.user_answer || '',
        confidence,
        rubricLevel: undefined as 'weak' | 'pass' | 'strong' | undefined,
      };
    });

    const jdContext = (session as any).jd_text || '';
    const resumeContext = (session as any).resume_text || '';

    const gapReport = await chatJSON<any>([
      {
        role: 'system',
        content: REPORTER_GAP_PROMPT({
          company: (session as any).company,
          role: (session as any).role,
          jdContext,
          resumeContext,
          completedQuestions,
        }),
      },
      { role: 'user', content: '请基于以上问答记录，输出差距报告JSON。' },
    ], { temperature: 0.3, maxTokens: 4096 });

    return res.json(gapReport);
  } catch (err: any) {
    return res.status(500).json({ error: true, message: `生成差距报告失败: ${err.message}` });
  }
});

router.post('/:id/complete', (req: Request, res: Response) => {
  db().update(sessions).set({ status: 'completed', completed_at: new Date().toISOString() }).where(eq(sessions.id, req.params.id)).run();
  return res.json(db().select().from(sessions).where(eq(sessions.id, req.params.id)).all()[0]);
});

export default router;
