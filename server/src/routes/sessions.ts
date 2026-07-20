import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { optionalAuth } from '../middleware/auth';
import { db, saveDb, sessions, interviewQuestions } from '../db';
import { eq, desc, sql } from 'drizzle-orm';

const router = Router();
router.use(optionalAuth);

router.post('/', (req: Request, res: Response) => {
  const { company, role, level } = req.body;
  const id = uuidv4();
  db().insert(sessions).values({ id, user_id: req.userId!, company: company || null, role: role || null, level: level || null, status: 'active' }).run();
  saveDb();
  const session = db().select().from(sessions).where(eq(sessions.id, id)).all()[0];
  return res.status(201).json(session);
});

router.get('/', (req: Request, res: Response) => {
  let result = db().select().from(sessions).where(eq(sessions.user_id, req.userId!)).orderBy(desc(sessions.created_at));
  const all = result.all();
  const { status } = req.query;
  if (status && typeof status === 'string') return res.json(all.filter((s: any) => s.status === status));
  return res.json(all);
});

router.get('/:id', (req: Request, res: Response) => {
  const session = db().select().from(sessions).where(eq(sessions.id, req.params.id)).all()[0];
  if (!session) return res.status(404).json({ error: true, message: '会话不存在' });
  const questions = db().select().from(interviewQuestions).where(eq(interviewQuestions.session_id, req.params.id)).orderBy(sql`sequence ASC`).all();
  return res.json({ ...session, questions });
});

router.patch('/:id', (req: Request, res: Response) => {
  const session = db().select().from(sessions).where(eq(sessions.id, req.params.id)).all()[0];
  if (!session) return res.status(404).json({ error: true, message: '会话不存在' });
  const { company, role, level } = req.body;
  const updates: Record<string, any> = {};
  if (company !== undefined) updates.company = company;
  if (role !== undefined) updates.role = role;
  if (level !== undefined) updates.level = level;
  if (Object.keys(updates).length > 0) { db().update(sessions).set(updates).where(eq(sessions.id, req.params.id)).run(); saveDb(); }
  return res.json(db().select().from(sessions).where(eq(sessions.id, req.params.id)).all()[0]);
});

router.delete('/:id', (req: Request, res: Response) => {
  db().delete(interviewQuestions).where(eq(interviewQuestions.session_id, req.params.id)).run();
  db().delete(sessions).where(eq(sessions.id, req.params.id)).run();
  saveDb();
  return res.json({ success: true });
});

export default router;
