/**
 * 面试官服务 — MockInterview.skill 4角色方法论驱动
 *
 * 角色分工：
 *   RECRUITER   → 简历×JD交集分析 + 隐藏评分标准生成（面试开始时）
 *   INTERVIEWER → 锁定深挖出题（工具→量级→判断→成果）
 *   ASSESSOR    → 对照隐藏标准打档 + 信心盲区记录
 *
 * 核心机制：
 *   1. 隐藏评分标准：每道题出题时写好三档标准（弱/合格/强），对用户隐藏，答完对照评分
 *   2. 锁定深挖：每题锁定简历上一个具体动作，沿"工具→量级→判断→成果"逐层追问，
 *      当前动作挖完前绝不切换话题
 *   3. 信心盲区：用户作答前自评信心(1-5)，答后对照实际表现，落差最大的即最该补的洞
 */
import { chatStream } from './client';
import { INTERVIEWER_DEEPDIVE_PROMPT, SYSTEM_PERSONA, ASSESSOR_SCORING_PROMPT } from './prompts';
import { db, saveDb, interviewQuestions } from '../../db';
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

/** MockInterview.skill Step 0.7 设置 */
interface InterviewSettings {
  intensity?: 'mild' | 'deep' | 'bar_raiser';
  feedbackMode?: 'practice' | 'exam';
}

// ── 从 AI 输出末尾提取题型标签 [CATEGORY-SUB] 或 [CATEGORY] ──
function parseQuestionTag(text: string): { question: string; category: string; sub_category: string } | null {
  const match = text.match(/\[([A-Z]{2,4})(?:-(\S+?))?\]\s*$/m);
  if (!match) return null;
  const tagLen = match[0].length;
  const question = text.slice(0, text.length - tagLen).trim();
  const lastPara = question.split(/\n\n+/).pop()?.trim() || question;
  return { question: lastPara, category: match[1], sub_category: match[2] || '' };
}

// ── 构造面试 Prompt（含 JD + 简历 + 深挖指令）──
function buildSystemPrompt(context: InterviewContext, questionHistory: string[], currentIndex: number): string {
  const jdSection = context.jdContext
    ? `\n## 岗位 JD（出题核心依据）\n${context.jdContext}\n\n请严格围绕 JD 中的职责和要求设计面试题。`
    : '\n（未提供 JD，请根据岗位名称和行业常识出题）';

  const resumeSection = context.resumeContext
    ? `\n## 候选人简历（锁定深挖的素材）\n${context.resumeContext}\n\n请锁定简历中的具体经历动作出题，沿"工具→量级→判断→成果"逐层深挖。`
    : '';

  return `${SYSTEM_PERSONA}\n\n${INTERVIEWER_DEEPDIVE_PROMPT}

## 面试背景
- 目标公司：${context.company || '未指定'}
- 目标岗位：${context.role || '产品经理'}
- 经验水平：${context.level || 'entry'}
${jdSection}${resumeSection}

## 已出题目
${questionHistory.length > 0 ? questionHistory.map((q, i) => `${i + 1}. ${q}`).join('\n') : '尚未出题'}

## 当前是第 ${currentIndex + 1} 题

## 出题策略（按优先级）
1. **JD 驱动**：每题映射 JD 中的具体职责要求
2. **简历锁定**：每题锁定简历中一条具体经历的动作，深挖到底再换题
3. **维度均衡**：覆盖 BQ/CASE/GEN，不连续出同类题
4. **首题策略**：首题推荐行为面试(BQ)，结合简历经历自然引入`;
}

/** 生成面试开场 + 第一题 */
async function generateFirstQuestion(
  context: InterviewContext,
  questionHistory: string[],
  onToken: (t: string) => void,
): Promise<{ questionText: string; category: string; subCategory: string }> {
  const systemPrompt = buildSystemPrompt(context, questionHistory, 0);
  const userPrompt = context.jdContext || context.resumeContext
    ? `请开始面试。开场白1-2句后直接出第一题。题目必须锁定JD具体职责或简历具体经历，末附题型标签。`
    : '请开始面试，开场白1-2句，然后出第一道面试题。';

  let fullText = '';
  await chatStream(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    (token) => { fullText += token; onToken(token); },
    () => {}, // onDone handled by caller
    (err) => { throw err; },
  );

  const parsed = parseQuestionTag(fullText);
  return {
    questionText: parsed?.question || fullText,
    category: parsed?.category || 'GEN',
    subCategory: parsed?.sub_category || '',
  };
}

/** 生成追问（锁定深挖风格，强度驱动） */
async function generateFollowUp(
  context: InterviewContext,
  currentQ: { question_text: string; category: string },
  answer: string,
  intensity: string,
  onToken: (t: string) => void,
): Promise<string> {
  const hasContext = !!(context.jdContext || context.resumeContext);

  const intensityGuide = intensity === 'bar_raiser'
    ? '你是 Bar-raiser，专找逻辑漏洞，追问要尖锐直接："你说的这个数字怎么来的？谁定的标准？如果换个做法会怎样？"'
    : intensity === 'mild'
      ? '你是温和 HR，追问要礼貌克制，点到为止。'
      : '你是深挖技术面试官，沿技术细节往下钻。';

  const followUpPrompt = hasContext
    ? `刚才题目：[${currentQ.category}] ${currentQ.question_text}\n候选人回答：${answer}\n\n${intensityGuide}\n作为 INTERVIEWER，请锁定当前题目涉及的简历动作，沿"工具→量级→你的判断→成果"方向进行追问。${context.resumeContext ? '不要切换到别的经历。' : ''}`
    : `刚才题目：[${currentQ.category}] ${currentQ.question_text}\n候选人回答：${answer}\n\n${intensityGuide}\n请进行追问深挖。`;

  let fullText = '';
  await chatStream(
    [{ role: 'system', content: `${SYSTEM_PERSONA}\n${INTERVIEWER_DEEPDIVE_PROMPT}` }, { role: 'user', content: followUpPrompt }],
    (token) => { fullText += token; onToken(token); },
    () => {},
    (err) => { throw err; },
  );
  return fullText;
}

/** 生成下一题（保持深挖风格） */
async function generateNextQuestion(
  context: InterviewContext,
  questionHistory: string[],
  onToken: (t: string) => void,
): Promise<{ questionText: string; category: string; subCategory: string }> {
  const hasContext = !!(context.jdContext || context.resumeContext);
  const systemPrompt = buildSystemPrompt(context, questionHistory, questionHistory.length);

  const userPrompt = hasContext
    ? `请出下一道面试题。要求：①新题不重复已出题目；②锁定简历中尚未被深挖过的经历或JD中未覆盖的职责；③与前面题型互补；④末附题型标签。`
    : '请自然过渡并出一道新的面试题，与前面题型互补。';

  let fullText = '';
  await chatStream(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    (token) => { fullText += token; onToken(token); },
    () => {},
    (err) => { throw err; },
  );

  const parsed = parseQuestionTag(fullText);
  return {
    questionText: parsed?.question || fullText,
    category: parsed?.category || 'GEN',
    subCategory: parsed?.sub_category || '',
  };
}

// ═══════════════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════════════

export async function streamInterviewChat(
  context: InterviewContext,
  request: { action: string; message?: string; confidence?: number; intensity?: string; feedbackMode?: string },
  onEvent: (event: { type: string; data: Record<string, unknown> }) => void,
): Promise<void> {
  const { action, message, confidence, intensity, feedbackMode } = request;
  const hasContext = !!(context.jdContext || context.resumeContext);
  const settings: InterviewSettings = {
    intensity: (intensity as 'mild' | 'deep' | 'bar_raiser') || 'deep',
    feedbackMode: (feedbackMode as 'practice' | 'exam') || 'practice',
  };

  const existingQuestions = db().select().from(interviewQuestions)
    .where(eq(interviewQuestions.session_id, context.sessionId))
    .orderBy(sql`sequence ASC`).all();

  const questionHistory = existingQuestions.map(
    q => `[${q.category}${q.sub_category ? '-' + q.sub_category : ''}] ${q.question_text}`,
  );

  // ═══════════════════════════════════════
  // START — 开始面试 / 第一题
  // ═══════════════════════════════════════
  if (action === 'start' || questionHistory.length === 0) {
    const sequence = existingQuestions.length + 1;
    const qId = uuidv4();

    try {
      const { questionText, category, subCategory } = await generateFirstQuestion(
        context, questionHistory,
        (token) => onEvent({ type: 'token', data: { text: token } }),
      );

      db().insert(interviewQuestions).values({
        id: qId, session_id: context.sessionId,
        question_text: questionText,
        category: category as QuestionCategory,
        sub_category: subCategory as QuestionSubCategory,
        sequence,
      }).run();
      saveDb();

      onEvent({ type: 'question', data: { question_id: qId, category: `${category}-${subCategory}`, text: questionText } });
      onEvent({ type: 'done', data: { question_id: qId } });
    } catch (err: any) {
      onEvent({ type: 'error', data: { message: err.message } });
    }
    return;
  }

  // ═══════════════════════════════════════
  // ANSWER — 用户作答 → ASSESSOR 打档 → 深挖追问 or 换题
  // ═══════════════════════════════════════
  if (action === 'answer' && message) {
    const currentQ = existingQuestions[existingQuestions.length - 1];
    if (!currentQ) {
      onEvent({ type: 'error', data: { message: '没有当前题目' } });
      return;
    }

    // ── 存储用户回答 + 信心分 ──
    const updateData: Record<string, unknown> = { user_answer: message };
    // 使用 feedback 字段存储信心分（JSON兼容）
    if (confidence !== undefined) {
      updateData.feedback = JSON.stringify({ confidence });
    }
    db().update(interviewQuestions).set(updateData).where(eq(interviewQuestions.id, currentQ.id)).run();
    saveDb();

    // ── ASSESSOR 判断是否深挖（强度影响阈值）──
    const deepDiveThreshold = settings.intensity === 'bar_raiser'
      ? 600   // Bar-raiser：几乎每题都追问
      : settings.intensity === 'mild'
        ? 150  // 温和HR：只有极短回答才追问
        : 400;  // 深挖技术：中短回答触发追问

    const shouldDeepDive = message.length < deepDiveThreshold;

    if (shouldDeepDive) {
      try {
        await generateFollowUp(context, currentQ, message, settings.intensity || 'deep',
          (token) => onEvent({ type: 'token', data: { text: token } }),
        );
        onEvent({ type: 'done', data: { question_id: currentQ.id, follow_up: true, intensity: settings.intensity } });
      } catch (err: any) {
        onEvent({ type: 'error', data: { message: err.message } });
      }
    } else {
      if (settings.feedbackMode === 'practice') {
        onEvent({ type: 'token', data: { text: '好的，了解了。' } });
      } else {
        onEvent({ type: 'token', data: { text: '好的。' } });
      }
      onEvent({ type: 'done', data: { question_id: currentQ.id, review_signal: true, feedbackMode: settings.feedbackMode } });
    }
    return;
  }

  // ═══════════════════════════════════════
  // NEXT — 出下一题（锁定深挖风格）
  // ═══════════════════════════════════════
  if (action === 'next_question') {
    const sequence = existingQuestions.length + 1;
    const qId = uuidv4();

    try {
      const { questionText, category, subCategory } = await generateNextQuestion(
        context, questionHistory,
        (token) => onEvent({ type: 'token', data: { text: token } }),
      );

      db().insert(interviewQuestions).values({
        id: qId, session_id: context.sessionId,
        question_text: questionText,
        category: category as QuestionCategory,
        sub_category: subCategory as QuestionSubCategory,
        sequence,
      }).run();
      saveDb();

      onEvent({ type: 'question', data: { question_id: qId, category: `${category}-${subCategory}`, text: questionText } });
      onEvent({ type: 'done', data: { question_id: qId } });
    } catch (err: any) {
      onEvent({ type: 'error', data: { message: err.message } });
    }
    return;
  }

  // ═══════════════════════════════════════
  // RATE — 对上一题单独评分（练习模式用）
  // ═══════════════════════════════════════
  if (action === 'rate_last') {
    const currentQ = existingQuestions[existingQuestions.length - 1];
    if (!currentQ?.user_answer) {
      onEvent({ type: 'done', data: {} });
      return;
    }

    // 使用 ASSESSOR 提示词进行快速评分
    const scoringPrompt = `${ASSESSOR_SCORING_PROMPT}\n\n题目：[${currentQ.category}] ${currentQ.question_text}\n候选人回答：${currentQ.user_answer}\n${currentQ.feedback ? `自评信心：${(() => { try { return JSON.parse(currentQ.feedback!).confidence; } catch { return '无'; } })()}` : ''}\n\n请评分并给出简短反馈。`;

    let fullText = '';
    try {
      await chatStream(
        [{ role: 'system', content: scoringPrompt }, { role: 'user', content: '请评分' }],
        (token) => { fullText += token; onEvent({ type: 'token', data: { text: token } }); },
        () => onEvent({ type: 'done', data: { question_id: currentQ.id, quick_feedback: true } }),
        (err) => onEvent({ type: 'error', data: { message: err.message } }),
      );
    } catch (err: any) {
      onEvent({ type: 'error', data: { message: err.message } });
    }
    return;
  }
}
