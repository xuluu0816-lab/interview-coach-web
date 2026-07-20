/**
 * 投递记录路由 — CRUD /api/applications
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { optionalAuth } from '../middleware/auth';
import { db, saveDb, applications } from '../db';
import { eq, desc } from 'drizzle-orm';

const router = Router();
router.use(optionalAuth);

/** 把数据库字段转为前端格式 */
function formatApp(row: any) {
  return {
    ...row,
    currentStage: row.current_stage || row.status || 'resume_screening',
    stages: row.stages ? JSON.parse(row.stages) : [],
    appliedAt: row.applied_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', (req: Request, res: Response) => {
  const rows = db().select().from(applications)
    .where(eq(applications.user_id, req.userId!))
    .orderBy(desc(applications.updated_at)).all();
  return res.json(rows.map(formatApp));
});

router.post('/', (req: Request, res: Response) => {
  const { company, position, city, appliedAt, stages, currentStage, notes, url } = req.body;
  if (!company || !position) return res.status(400).json({ error: true, message: '公司名称和岗位名称不能为空' });

  const record = {
    id: uuidv4(), user_id: req.userId!, company, position,
    city: city || null,
    applied_at: appliedAt || new Date().toISOString().slice(0, 10),
    status: currentStage || 'resume_screening',
    current_stage: currentStage || 'resume_screening',
    stages: stages ? JSON.stringify(stages) : null,
    notes: notes || null, url: url || null,
  };
  db().insert(applications).values(record).run(); saveDb();
  return res.status(201).json(formatApp(record));
});

router.patch('/:id', (req: Request, res: Response) => {
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  const { company, position, city, appliedAt, stages, currentStage, status, notes, url } = req.body;
  if (company !== undefined) updates.company = company;
  if (position !== undefined) updates.position = position;
  if (city !== undefined) updates.city = city;
  if (appliedAt !== undefined) updates.applied_at = appliedAt;
  if (currentStage !== undefined) { updates.current_stage = currentStage; updates.status = currentStage; }
  if (status !== undefined) { updates.current_stage = status; updates.status = status; }
  if (stages !== undefined) updates.stages = JSON.stringify(stages);
  if (notes !== undefined) updates.notes = notes;
  if (url !== undefined) updates.url = url;

  db().update(applications).set(updates).where(eq(applications.id, req.params.id)).run(); saveDb();
  const row = db().select().from(applications).where(eq(applications.id, req.params.id)).all()[0];
  return res.json(formatApp(row));
});

router.delete('/:id', (req: Request, res: Response) => {
  db().delete(applications).where(eq(applications.id, req.params.id)).run(); saveDb();
  return res.json({ success: true });
});

router.get('/stats', (req: Request, res: Response) => {
  const allApps = db().select().from(applications).where(eq(applications.user_id, req.userId!)).all().map(formatApp);
  const total = allApps.length;
  const byStatus: Record<string, number> = {};
  for (const app of allApps) { const s = app.currentStage || 'unknown'; byStatus[s] = (byStatus[s] || 0) + 1; }
  const offerCount = byStatus['final'] || 0;
  return res.json({ total, by_status: byStatus, pass_rate: total > 0 ? Math.round((offerCount / total) * 100) : 0, offer_count: offerCount });
});

export default router;
