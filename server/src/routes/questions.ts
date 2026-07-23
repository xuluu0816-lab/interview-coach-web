import { Router, Request, Response } from 'express';
import { db, questionBank } from '../db';
import { eq } from 'drizzle-orm';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { category, difficulty, sub_category } = req.query;
  let query: any = db().select().from(questionBank);
  if (category && typeof category === 'string') query = query.where(eq(questionBank.category, category as any));
  if (difficulty && typeof difficulty === 'string') query = query.where(eq(questionBank.difficulty, difficulty as any));
  if (sub_category && typeof sub_category === 'string') query = query.where(eq(questionBank.sub_category, sub_category as any));
  return res.json(query.all());
});

router.get('/random', (req: Request, res: Response) => {
  const { category, difficulty } = req.query;
  let query: any = db().select().from(questionBank);
  if (category && typeof category === 'string') query = query.where(eq(questionBank.category, category as any));
  if (difficulty && typeof difficulty === 'string') query = query.where(eq(questionBank.difficulty, difficulty as any));
  const all = query.all();
  if (all.length === 0) return res.status(404).json({ error: true, message: '没有匹配的题目' });
  return res.json(all[Math.floor(Math.random() * all.length)]);
});

export default router;
