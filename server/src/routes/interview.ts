import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';
import { db, sessions, interviewQuestions } from '../db';
import { eq } from 'drizzle-orm';
import { streamInterviewChat } from '../services/ai/interviewer';

const router = Router();
router.use(optionalAuth);

router.post('/:id/chat', (req: Request, res: Response) => {
  const sessionId = req.params.id;
  const { action, message } = req.body;

  const session = db().select().from(sessions).where(eq(sessions.id, sessionId)).all()[0];
  if (!session) return res.status(404).json({ error: true, message: '会话不存在' });

  let resumeContext: string | undefined;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendSSE = (event: string, data: Record<string, unknown>) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  streamInterviewChat(
    {
      sessionId,
      company: (session as any).company || undefined,
      role: (session as any).role || undefined,
      level: (session as any).level || undefined,
      resumeContext,
    },
    { action, message },
    (event) => sendSSE(event.type, event.data)
  ).then(() => res.end()).catch((err) => { sendSSE('error', { message: err.message }); res.end(); });
});

export default router;
