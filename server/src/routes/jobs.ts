import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { optionalAuth } from '../middleware/auth';
import { db, saveDb, jobListings, savedJobs } from '../db';
import { eq, desc, like, or } from 'drizzle-orm';

const router = Router();
router.use(optionalAuth);

router.get('/', (req: Request, res: Response) => {
  const { q, job_type, city } = req.query;
  let result = db().select().from(jobListings);
  if (q && typeof q === 'string') result = result.where(or(like(jobListings.position, `%${q}%`), like(jobListings.company, `%${q}%`))) as any;
  if (job_type && typeof job_type === 'string') result = result.where(eq(jobListings.job_type, job_type as any));
  if (city && typeof city === 'string') result = result.where(like(jobListings.city, `%${city}%`));
  return res.json(result.orderBy(desc(jobListings.created_at)).all());
});

router.post('/:id/save', (req: Request, res: Response) => {
  const job = db().select().from(jobListings).where(eq(jobListings.id, req.params.id)).all()[0];
  if (!job) return res.status(404).json({ error: true, message: '岗位不存在' });
  const existing = db().select().from(savedJobs).all().filter(sj => sj.job_id === req.params.id && sj.user_id === req.userId);
  if (existing.length > 0) return res.json({ saved: true, message: '已收藏' });
  db().insert(savedJobs).values({ id: uuidv4(), user_id: req.userId!, job_id: req.params.id }).run();
  saveDb();
  return res.json({ saved: true });
});

router.delete('/:id/save', (req: Request, res: Response) => { db().delete(savedJobs).where(eq(savedJobs.job_id, req.params.id)).run(); saveDb(); return res.json({ saved: false }); });

export default router;
