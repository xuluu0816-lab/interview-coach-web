import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { optionalAuth } from '../middleware/auth';
import { db, saveDb, applications } from '../db';
import { eq, desc } from 'drizzle-orm';

const router = Router();
router.use(optionalAuth);

router.get('/', (req: Request, res: Response) => {
  const { status } = req.query;
  let result = db().select().from(applications).where(eq(applications.user_id, req.userId!)).orderBy(desc(applications.updated_at));
  if (status && typeof status === 'string') result = result.where(eq(applications.status, status as any));
  return res.json(result.all());
});

router.post('/', (req: Request, res: Response) => {
  const { company, position, city, applied_at, status, notes, url } = req.body;
  if (!company || !position) return res.status(400).json({ error: true, message: '公司名称和岗位名称不能为空' });
  const record = { id: uuidv4(), user_id: req.userId!, company, position, city: city || null, applied_at: applied_at || new Date().toISOString().slice(0, 10), status: status || 'applied', notes: notes || null, url: url || null };
  db().insert(applications).values(record).run();
  saveDb();
  return res.status(201).json(record);
});

router.patch('/:id', (req: Request, res: Response) => {
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  const { company, position, city, applied_at, status, notes, url } = req.body;
  if (company !== undefined) updates.company = company;
  if (position !== undefined) updates.position = position;
  if (city !== undefined) updates.city = city;
  if (applied_at !== undefined) updates.applied_at = applied_at;
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  if (url !== undefined) updates.url = url;
  db().update(applications).set(updates).where(eq(applications.id, req.params.id)).run();
  saveDb();
  return res.json(db().select().from(applications).where(eq(applications.id, req.params.id)).all()[0]);
});

router.delete('/:id', (req: Request, res: Response) => { db().delete(applications).where(eq(applications.id, req.params.id)).run(); saveDb(); return res.json({ success: true }); });

router.get('/stats', (req: Request, res: Response) => {
  const allApps = db().select().from(applications).where(eq(applications.user_id, req.userId!)).all();
  const total = allApps.length;
  const byStatus: Record<string, number> = {};
  for (const app of allApps) { byStatus[app.status] = (byStatus[app.status] || 0) + 1; }
  const offerCount = byStatus['offer'] || 0;
  const passedCount = ['offer', 'hr', 'interview2'].reduce((s, k) => s + (byStatus[k] || 0), 0);
  return res.json({ total, by_status: byStatus, pass_rate: total > 0 ? Math.round((passedCount / total) * 100) : 0, offer_count: offerCount });
});

export default router;
