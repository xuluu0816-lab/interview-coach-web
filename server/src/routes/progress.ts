import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';
import { generateProgressReport } from '../services/ai/reviewer';

const router = Router();
router.use(optionalAuth);

router.get('/', async (req: Request, res: Response) => {
  try {
    const report = await generateProgressReport(req.userId!);
    return res.json(report);
  } catch (err: any) {
    return res.status(500).json({ error: true, message: `生成报告失败: ${err.message}` });
  }
});

export default router;
