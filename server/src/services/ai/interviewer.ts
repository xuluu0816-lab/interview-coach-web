/**
 * 面试官服务 — 管理面试对话逻辑
 */
import { chatStream } from './client';
import { INTERVIEWER_PROMPT, SYSTEM_PERSONA } from './prompts';
import { db, saveDb, sessions, interviewQuestions, questionBank } from '../../db';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { QuestionCategory, QuestionSubCategory } from '../../types';

interface InterviewContext {
  sessionId: string;
  company?: string;
  role?: string;
  level?: string;
  questionTypes?: string[];
  resumeContext?: string;
}

async function selectQuestion(
  context: InterviewContext,
  questionHistory: string[]
): Promise<{ id: string; category: string; sub_category: string; question_text: string }> {
  const preferredTypes = context.questionTypes?.length ? context.questionTypes : ['BQ', 'CASE', 'GEN'];
  const usedSubCats = new Set<string>();
  for (const qText of questionHistory) {
    const match = qText.match(/\[(.*?)\]/);
    if (match) usedSubCats.add(match[1]);
  }

  for (const cat of preferredTypes) {
    let rows = db().select().from(questionBank).where(eq(questionBank.category, cat as QuestionCategory)).all();
    const fresh = rows.filter(r => !usedSubCats.has(`${cat}-${r.sub_category}`));
    if (fresh.length > 0) rows = fresh;
    if (rows.length > 0) return rows[Math.floor(Math.random() * rows.length)];
  }

  const all = db().select().from(questionBank).all();
  return all[Math.floor(Math.random() * all.length)];
}

export async function streamInterviewChat(
  context: InterviewContext,
  request: { action: string; message?: string },
  onEvent: (event: { type: string; data: Record<string, unknown> }) => void
): Promise<void> {
  const { action, message } = request;

  const existingQuestions = db().select().from(interviewQuestions)
    .where(eq(interviewQuestions.session_id, context.sessionId))
    .orderBy(sql`sequence ASC`).all();

  const questionHistory = existingQuestions.map(
    q => `[${q.category}${q.sub_category ? '-' + q.sub_category : ''}] ${q.question_text}`
  );

  if (action === 'start' || questionHistory.length === 0) {
    const picked = await selectQuestion(context, questionHistory);
    const qId = uuidv4();
    const sequence = existingQuestions.length + 1;
    db().insert(interviewQuestions).values({
      id: qId, session_id: context.sessionId, question_text: picked.question_text,
      category: picked.category as QuestionCategory, sub_category: picked.sub_category as QuestionSubCategory, sequence,
    }).run();
    saveDb();

    const messages = [
      { role: 'system' as const, content: `${SYSTEM_PERSONA}\n\n${INTERVIEWER_PROMPT({
        company: context.company, role: context.role, level: context.level,
        questionTypes: context.questionTypes, resumeContext: context.resumeContext,
        questionHistory, currentQuestionIndex: 0,
      })}` },
      { role: 'user' as const, content: '请开始面试，出一个开场白并给出第一道面试题。' },
    ];

    await chatStream(messages,
      (token) => onEvent({ type: 'token', data: { text: token } }),
      () => {
        onEvent({ type: 'question', data: { question_id: qId, category: `${picked.category}-${picked.sub_category}`, text: picked.question_text } });
        onEvent({ type: 'done', data: { question_id: qId } });
      },
      (err) => onEvent({ type: 'error', data: { message: err.message } })
    );
    return;
  }

  if (action === 'answer' && message) {
    const currentQ = existingQuestions[existingQuestions.length - 1];
    if (currentQ) {
      db().update(interviewQuestions).set({ user_answer: message }).where(eq(interviewQuestions.id, currentQ.id)).run();
      saveDb();
    }

    const shouldFollowUp = currentQ?.category === 'BQ' && message.length < 200;
    if (shouldFollowUp) {
      const followUpMessages = [
        { role: 'system' as const, content: SYSTEM_PERSONA },
        { role: 'user' as const, content: `刚才我出了这道题：[${currentQ?.category}] ${currentQ?.question_text}\n候选人回答：${message}\n\n请作为一个严格的面试官进行1次追问深挖。追问要具体，针对回答中的薄弱环节。` },
      ];
      await chatStream(followUpMessages,
        (token) => onEvent({ type: 'token', data: { text: token } }),
        () => onEvent({ type: 'done', data: { question_id: currentQ?.id || '', follow_up: true } }),
        (err) => onEvent({ type: 'error', data: { message: err.message } })
      );
    } else {
      onEvent({ type: 'token', data: { text: '好的，我了解了。' } });
      onEvent({ type: 'done', data: { question_id: currentQ?.id || '', review_signal: true } });
    }
    return;
  }

  if (action === 'next_question') {
    const picked = await selectQuestion(context, questionHistory);
    const qId = uuidv4();
    const sequence = existingQuestions.length + 1;
    db().insert(interviewQuestions).values({
      id: qId, session_id: context.sessionId, question_text: picked.question_text,
      category: picked.category as QuestionCategory, sub_category: picked.sub_category as QuestionSubCategory, sequence,
    }).run();
    saveDb();

    const nextMessages = [
      { role: 'system' as const, content: `${SYSTEM_PERSONA}\n\n${INTERVIEWER_PROMPT({
        company: context.company, role: context.role, level: context.level,
        questionTypes: context.questionTypes, resumeContext: context.resumeContext,
        questionHistory: [...questionHistory, picked.question_text], currentQuestionIndex: questionHistory.length,
      })}` },
      { role: 'user' as const, content: '请自然过渡并出一道新的面试题。' },
    ];

    await chatStream(nextMessages,
      (token) => onEvent({ type: 'token', data: { text: token } }),
      () => {
        onEvent({ type: 'question', data: { question_id: qId, category: `${picked.category}-${picked.sub_category}`, text: picked.question_text } });
        onEvent({ type: 'done', data: { question_id: qId } });
      },
      (err) => onEvent({ type: 'error', data: { message: err.message } })
    );
    return;
  }
}
