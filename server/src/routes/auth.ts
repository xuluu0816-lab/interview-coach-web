import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { db, saveDb, users } from '../db';
import { eq } from 'drizzle-orm';

const router = Router();

router.post('/register', (req: Request, res: Response) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: true, message: '邮箱不能为空' });

  const existing = db().select().from(users).where(eq(users.email, email)).all();
  if (existing.length > 0) return res.status(409).json({ error: true, message: '该邮箱已注册' });

  const user = { id: uuidv4(), email, name: name || email.split('@')[0], avatar_url: null, created_at: new Date().toISOString() };
  db().insert(users).values(user).run();
  saveDb();

  const token = jwt.sign({ userId: user.id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as any);
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

router.post('/login', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: true, message: '邮箱不能为空' });

  const existing = db().select().from(users).where(eq(users.email, email)).all();
  let user = existing[0] as any;

  if (!user) {
    user = { id: uuidv4(), email, name: email.split('@')[0], avatar_url: null, created_at: new Date().toISOString() };
    db().insert(users).values(user).run();
    saveDb();
    const token = jwt.sign({ userId: user.id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as any);
    return res.json({ token, user: { id: user.id, email: user.email, name: user.name }, isNew: true });
  }

  const token = jwt.sign({ userId: user.id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as any);
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

export default router;
