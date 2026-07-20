import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';
import { db, sessions } from '../db';
import { eq } from 'drizzle-orm';
import { generateReviewReport } from '../services/ai/reviewer';

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

router.post('/:id/complete', (req: Request, res: Response) => {
  db().update(sessions).set({ status: 'completed', completed_at: new Date().toISOString() }).where(eq(sessions.id, req.params.id)).run();
  return res.json(db().select().from(sessions).where(eq(sessions.id, req.params.id)).all()[0]);
});

export default router;
