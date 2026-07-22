/**
 * 面试官服务 — 管理面试对话逻辑
 *
 * 当 JD 或简历上下文存在时：AI 直接从 JD+简历生成面试题，不依赖静态题库
 * 无上下文时：回退到静态题库（questionBank）
 */
import { chatStream } from './client';
import { INTERVIEWER_PROMPT, SYSTEM_PERSONA } from './prompts';
import { db, saveDb, interviewQuestions, questionBank } from '../../db';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { QuestionCategory, QuestionSubCategory } from '../../types';

interface InterviewContext {
  sessionId: string;
  company?: string;
  role?: string;
  level?: string;
  questionTypes?: string[];
  jdContext?: string;
  resumeContext?: string;
}

// ── 从 AI 输出末尾提取题型标签 [CATEGORY-SUB] 或 [CATEGORY] ──
function parseQuestionTag(text: string): { question: string; category: string; sub_category: string } | null {
  const match = text.match(/\[([A-Z]{2,4})(?:-(\S+?))?\]\s*$/m);
  if (!match) return null;
  const tagLen = match[0].length;
  const question = text.slice(0, text.length - tagLen).trim();
  // 只取最后一个自然段（从最后一个换行开始的部分）作为题目文本
  const lastPara = question.split(/\n\n+/).pop()?.trim() || question;
  return {
    question: lastPara,
    category: match[1],
    sub_category: match[2] || '',
  };
}

// ── 静态题库回退 ──
async function selectFromBank(
  context: InterviewContext,
  questionHistory: string[],
): Promise<{ id: string; category: string; sub_category: string; question_text: string }> {
  const preferredTypes = context.questionTypes?.length ? context.questionTypes : ['BQ', 'CASE', 'GEN'];
  const usedSubCats = new Set<string>();
  for (const qText of questionHistory) {
    const m = qText.match(/\[(.*?)\]/);
    if (m) usedSubCats.add(m[1]);
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

// ── 构造系统 prompt（含 JD + 简历）──
function buildSystemPrompt(context: InterviewContext, questionHistory: string[], currentIndex: number): string {
  return `${SYSTEM_PERSONA}\n\n${INTERVIEWER_PROMPT({
    company: context.company,
    role: context.role,
    level: context.level,
    questionTypes: context.questionTypes,
    jdContext: context.jdContext,
    resumeContext: context.resumeContext,
    questionHistory,
    currentQuestionIndex: currentIndex,
  })}`;
}

export async function streamInterviewChat(
  context: InterviewContext,
  request: { action: string; message?: string },
  onEvent: (event: { type: string; data: Record<string, unknown> }) => void,
): Promise<void> {
  const { action, message } = request;
  const hasContext = !!(context.jdContext || context.resumeContext);

  const existingQuestions = db().select().from(interviewQuestions)
    .where(eq(interviewQuestions.session_id, context.sessionId))
    .orderBy(sql`sequence ASC`).all();

  const questionHistory = existingQuestions.map(
    q => `[${q.category}${q.sub_category ? '-' + q.sub_category : ''}] ${q.question_text}`,
  );

  // ═══════════════════════════════════════════════════
  // START — 开始面试 / 第一题
  // ═══════════════════════════════════════════════════
  if (action === 'start' || questionHistory.length === 0) {
    const sequence = existingQuestions.length + 1;
    const qId = uuidv4();

    if (hasContext) {
      // ── JD + 简历模式：AI 自主出题，不用题库 ──
      const systemPrompt = buildSystemPrompt(context, questionHistory, 0);
      const userPrompt = `请开始面试。要求：
1. 简短的开场白（1-2句），然后直接出第一道题
2. 题目必须直接关联上述 JD 中的具体职责要求或简历中的具体经历
3. 题目内容要具体，不能泛泛而谈（如"说说你的优点"这种禁用）
4. 题目末尾必须加上题型标签，如 [BQ-领导力]、[CASE-产品设计] 等`;

      let fullText = '';
      await chatStream(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        (token) => { fullText += token; onEvent({ type: 'token', data: { text: token } }); },
        () => {
          const parsed = parseQuestionTag(fullText);
          const questionText = parsed?.question || fullText;
          const category = parsed?.category || 'GEN';
          const subCategory = parsed?.sub_category || '';

          db().insert(interviewQuestions).values({
            id: qId, session_id: context.sessionId, question_text: questionText,
            category: category as QuestionCategory, sub_category: subCategory as QuestionSubCategory, sequence,
          }).run();
          saveDb();
          onEvent({ type: 'question', data: { question_id: qId, category: `${category}-${subCategory}`, text: questionText } });
          onEvent({ type: 'done', data: { question_id: qId } });
        },
        (err) => onEvent({ type: 'error', data: { message: err.message } }),
      );
    } else {
      // ── 无上下文：回退静态题库 ──
      const picked = await selectFromBank(context, questionHistory);
      db().insert(interviewQuestions).values({
        id: qId, session_id: context.sessionId, question_text: picked.question_text,
        category: picked.category as QuestionCategory, sub_category: picked.sub_category as QuestionSubCategory, sequence,
      }).run();
      saveDb();

      const systemPrompt = buildSystemPrompt(context, questionHistory, 0);
      await chatStream(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: '请开始面试，出一个开场白并给出第一道面试题。' }],
        (token) => onEvent({ type: 'token', data: { text: token } }),
        () => {
          onEvent({ type: 'question', data: { question_id: qId, category: `${picked.category}-${picked.sub_category}`, text: picked.question_text } });
          onEvent({ type: 'done', data: { question_id: qId } });
        },
        (err) => onEvent({ type: 'error', data: { message: err.message } }),
      );
    }
    return;
  }

  // ═══════════════════════════════════════════════════
  // ANSWER — 用户作答 → 追问 or 下一题
  // ═══════════════════════════════════════════════════
  if (action === 'answer' && message) {
    const currentQ = existingQuestions[existingQuestions.length - 1];
    if (currentQ) {
      db().update(interviewQuestions).set({ user_answer: message }).where(eq(interviewQuestions.id, currentQ.id)).run();
      saveDb();
    }

    // 有 JD 上下文时更积极追问（不限于 BQ，且阈值放宽）
    const shouldFollowUp = hasContext
      ? message.length < 400
      : currentQ?.category === 'BQ' && message.length < 200;

    if (shouldFollowUp) {
      const followUpPrompt = hasContext
        ? `刚才我出了这道题：[${currentQ?.category}] ${currentQ?.question_text}\n候选人回答：${message}\n\n这次回答比较简短。请作为严格的面试官进行1次追问深挖。追问要：1）具体指向回答中未说清楚的点；2）如果有JD和简历上下文，优先针对回答中与JD要求相关的薄弱环节进行挑战。`
        : `刚才我出了这道题：[${currentQ?.category}] ${currentQ?.question_text}\n候选人回答：${message}\n\n请作为一个严格的面试官进行1次追问深挖。追问要具体，针对回答中的薄弱环节。`;

      await chatStream(
        [{ role: 'system', content: SYSTEM_PERSONA }, { role: 'user', content: followUpPrompt }],
        (token) => onEvent({ type: 'token', data: { text: token } }),
        () => onEvent({ type: 'done', data: { question_id: currentQ?.id || '', follow_up: true } }),
        (err) => onEvent({ type: 'error', data: { message: err.message } }),
      );
    } else {
      onEvent({ type: 'token', data: { text: '好的，我了解了。' } });
      onEvent({ type: 'done', data: { question_id: currentQ?.id || '', review_signal: true } });
    }
    return;
  }

  // ═══════════════════════════════════════════════════
  // NEXT — 出下一题
  // ═══════════════════════════════════════════════════
  if (action === 'next_question') {
    const sequence = existingQuestions.length + 1;
    const qId = uuidv4();

    if (hasContext) {
      // ── JD + 简历模式：AI 自主出下一题 ──
      const systemPrompt = buildSystemPrompt(context, questionHistory, questionHistory.length);
      const userPrompt = `请出一道新的面试题。要求：
1. 必须是一道新题，不能与已出题目重复或雷同
2. 题目必须直接关联 JD 中的具体职责要求或简历中的具体经历
3. 结合候选人在前面题目的表现，如果前几题集中在某类题型，请切换到不同题型
4. 题目内容要具体，不能泛泛而谈
5. 可以先做简短过渡（1句话），然后自然出题
6. 题目末尾必须加上题型标签，如 [BQ-领导力]、[CASE-产品设计] 等`;

      let fullText = '';
      await chatStream(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        (token) => { fullText += token; onEvent({ type: 'token', data: { text: token } }); },
        () => {
          const parsed = parseQuestionTag(fullText);
          const questionText = parsed?.question || fullText;
          const category = parsed?.category || 'GEN';
          const subCategory = parsed?.sub_category || '';

          db().insert(interviewQuestions).values({
            id: qId, session_id: context.sessionId, question_text: questionText,
            category: category as QuestionCategory, sub_category: subCategory as QuestionSubCategory, sequence,
          }).run();
          saveDb();
          onEvent({ type: 'question', data: { question_id: qId, category: `${category}-${subCategory}`, text: questionText } });
          onEvent({ type: 'done', data: { question_id: qId } });
        },
        (err) => onEvent({ type: 'error', data: { message: err.message } }),
      );
    } else {
      // ── 无上下文：回退静态题库 ──
      const picked = await selectFromBank(context, questionHistory);
      db().insert(interviewQuestions).values({
        id: qId, session_id: context.sessionId, question_text: picked.question_text,
        category: picked.category as QuestionCategory, sub_category: picked.sub_category as QuestionSubCategory, sequence,
      }).run();
      saveDb();

      const systemPrompt = buildSystemPrompt(context, [...questionHistory, picked.question_text], questionHistory.length);
      await chatStream(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: '请自然过渡并出一道新的面试题。' }],
        (token) => onEvent({ type: 'token', data: { text: token } }),
        () => {
          onEvent({ type: 'question', data: { question_id: qId, category: `${picked.category}-${picked.sub_category}`, text: picked.question_text } });
          onEvent({ type: 'done', data: { question_id: qId } });
        },
        (err) => onEvent({ type: 'error', data: { message: err.message } }),
      );
    }
    return;
  }
}
