/**
 * 面试官服务 — MockInterview.skill 4角色方法论驱动
 *
 * PHASE 1 按轮次实时出题（不预存题库）：
 *   行为面 → 简历深挖 → 案例设计 → 技术领域 → 反问环节
 *   每题由后端大模型实时解析简历+JD，按当前轮次规则生成
 *
 * 角色分工：
 *   INTERVIEWER → 分轮出题 + 锁定深挖（工具→量级→判断→成果）
 *   ASSESSOR    → 对照标准打档 + 信心盲区记录
 *
 * PHASE 2（差距报告）才做简历×JD交集分析 + 能力维度框架定义
 */
import { chatStream, chat } from './client';
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
  jdContext?: string;
  resumeContext?: string;
}

/** MockInterview.skill Step 0.7 设置 */
interface InterviewSettings {
  intensity?: 'mild' | 'deep' | 'bar_raiser';
  feedbackMode?: 'practice' | 'exam';
}

// ═══════════════════════════════════════════════
// 轮次定义（MockInterview.skill PHASE 1）
// ═══════════════════════════════════════════════
interface RoundDef {
  name: string;
  slug: string;
  focus: string;
  questionType: string;
  maxQuestions: number;
  requiresResume: boolean;
  instruction: string;
}

const ROUNDS: RoundDef[] = [
  {
    name: '行为面', slug: 'behavioral', focus: '经历、动机、协作',
    questionType: 'STAR 类', maxQuestions: 3, requiresResume: false,
    instruction: '出 STAR 类行为面试题，考察候选人的经历真实性、动机、协作能力。结合JD职责反向设计场景，优先锁定简历中的具体经历出题，让候选人用 STAR 结构回答。',
  },
  {
    name: '简历深挖', slug: 'resume_deep_dive', focus: '简历经历的真实性与纵深',
    questionType: '锁定简历动作，沿工具/量级/判断/成果挖', maxQuestions: 3, requiresResume: true,
    instruction: '锁定简历中一条尚未被深挖过的具体经历动作，出深挖题。沿"用了什么工具/方法 → 处理量级/规模 → 你的判断/决策 → 成果/影响"方向设计。每题只锁定一个动作，挖完前绝不切换。',
  },
  {
    name: '案例设计', slug: 'case_design', focus: '产品/系统设计',
    questionType: '设计题', maxQuestions: 2, requiresResume: false,
    instruction: '出产品/系统设计题。可以是"设计一个X"或"你怎么改进/评估我们的Y产品"。结合JD中提到的产品、业务领域，让题目落在真实场景上而非抽象题。',
  },
  {
    name: '技术领域', slug: 'tech_domain', focus: '领域纵深、硬知识',
    questionType: '概念、方案权衡、领域前沿', maxQuestions: 2, requiresResume: false,
    instruction: '出技术/领域纵深题。考察概念理解深度、方案权衡能力、领域前沿认知。结合JD中的技术要求或行业知识出题。',
  },
  {
    name: '反问环节', slug: 'counter', focus: '提问质量',
    questionType: '反问', maxQuestions: 1, requiresResume: false,
    instruction: '面试部分结束。告诉候选人"面试部分到此结束，接下来是反问环节，你有什么想问我的？"可以给1-2个引导方向，但主要由候选人提问。',
  },
];

// ═══════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════

/** 根据简历/JD判断哪些轮次可用 */
function getAvailableRounds(hasResume: boolean): RoundDef[] {
  return ROUNDS.filter(r => !r.requiresResume || hasResume);
}

/** 从已存题目推断当前轮次和轮内题号 */
function getCurrentRoundInfo(existingQuestions: any[], hasResume: boolean): {
  currentRoundIndex: number;
  questionsInRound: number;
} {
  const available = getAvailableRounds(hasResume);

  if (existingQuestions.length === 0) {
    return { currentRoundIndex: 0, questionsInRound: 0 };
  }

  // 从最后一道题的 feedback 中读取轮次
  const lastQ = existingQuestions[existingQuestions.length - 1];
  let lastRound = '';
  try {
    const fb = JSON.parse(lastQ.feedback || '{}');
    lastRound = fb.round || '';
  } catch { /* ignore */ }

  if (!lastRound) {
    // 没记录轮次，根据 sequence 估算
    const seq = existingQuestions.length;
    let acc = 0;
    for (let i = 0; i < available.length; i++) {
      acc += available[i].maxQuestions;
      if (seq <= acc) return { currentRoundIndex: i, questionsInRound: seq - (acc - available[i].maxQuestions) };
    }
    return { currentRoundIndex: available.length - 1, questionsInRound: seq - (acc - available[available.length - 1].maxQuestions) };
  }

  const roundIdx = available.findIndex(r => r.name === lastRound || r.slug === lastRound);
  if (roundIdx === -1) return { currentRoundIndex: 0, questionsInRound: existingQuestions.length };

  // 数本轮已有几题
  let qInRound = 0;
  for (let i = existingQuestions.length - 1; i >= 0; i--) {
    try {
      const fb = JSON.parse(existingQuestions[i].feedback || '{}');
      if ((fb.round || '') === lastRound) qInRound++;
      else break;
    } catch { break; }
  }

  return { currentRoundIndex: roundIdx, questionsInRound: qInRound };
}

/** 确定下一题的轮次 */
function determineNextRound(existingQuestions: any[], hasResume: boolean): {
  round: RoundDef;
  questionIndex: number;
  isTransition: boolean;
  previousRound?: RoundDef;
} {
  const available = getAvailableRounds(hasResume);
  if (existingQuestions.length === 0) {
    return { round: available[0], questionIndex: 1, isTransition: false };
  }

  const { currentRoundIndex, questionsInRound } = getCurrentRoundInfo(existingQuestions, hasResume);
  const currentRound = available[currentRoundIndex] || available[available.length - 1];

  // 当前轮次还有题量空间 → 继续本轮
  if (questionsInRound < currentRound.maxQuestions) {
    return { round: currentRound, questionIndex: questionsInRound + 1, isTransition: false };
  }

  // 过渡到下一轮
  const nextRoundIdx = currentRoundIndex + 1;
  if (nextRoundIdx >= available.length) {
    const lastRound = available[available.length - 1];
    return { round: lastRound, questionIndex: 1, isTransition: true, previousRound: currentRound };
  }

  return { round: available[nextRoundIdx], questionIndex: 1, isTransition: true, previousRound: currentRound };
}

/** 从 AI 输出末尾提取题型标签 [CATEGORY-SUB] 或 [CATEGORY] */
function parseQuestionTag(text: string): { question: string; category: string; subCategory: string } | null {
  const match = text.match(/\[([A-Z]{2,4})(?:-(\S+?))?\]\s*$/m);
  if (!match) return null;
  const tagLen = match[0].length;
  const question = text.slice(0, text.length - tagLen).trim();
  const lastPara = question.split(/\n\n+/).pop()?.trim() || question;
  return { question: lastPara, category: match[1], subCategory: match[2] || '' };
}

// ═══════════════════════════════════════════════
// 出题函数
// ═══════════════════════════════════════════════

/** 构建分轮出题的系统 Prompt */
function buildRoundPrompt(
  context: InterviewContext,
  round: RoundDef,
  questionIndex: number,
  questionHistory: string[],
  isTransition: boolean,
  previousRound?: RoundDef,
): string {
  const jdSection = context.jdContext
    ? `\n## 岗位 JD（出题核心依据）\n${context.jdContext}\n\n请严格围绕 JD 中的职责和要求设计面试题。`
    : '\n（未提供 JD，请根据岗位名称和行业常识出题）';

  const resumeSection = context.resumeContext
    ? `\n## 候选人简历（锁定深挖的素材）\n${context.resumeContext}\n\n请锁定简历中的具体经历动作出题，沿"工具→量级→判断→成果"逐层深挖。`
    : '';

  const transitionNote = isTransition && previousRound
    ? `\n## ⚠️ 轮次过渡\n上一轮「${previousRound.name}」已结束。请用1句话小结该轮印象，然后用 "── 第X轮 ──" 标记进入新一轮「${round.name}」。`
    : '';

  return `${SYSTEM_PERSONA}\n\n${INTERVIEWER_DEEPDIVE_PROMPT}

## 面试背景
- 目标公司：${context.company || '未指定'}
- 目标岗位：${context.role || '产品经理'}
- 经验水平：${context.level || 'entry'}
${jdSection}${resumeSection}

## 当前轮次：${round.name}（本轮第 ${questionIndex} 题 / 最多 ${round.maxQuestions} 题）
- 侧重：${round.focus}
- 题型要求：${round.questionType}
- 出题指令：${round.instruction}
${transitionNote}

## 已出题目
${questionHistory.length > 0 ? questionHistory.map((q, i) => `${i + 1}. ${q}`).join('\n') : '尚未出题'}

## 注意
- 严格按照「${round.name}」轮次的侧重出题
- 每题锁定 JD 中的具体职责要求
${context.resumeContext ? '- 优先锁定简历中具体经历的动作出题' : ''}
- 一次只出一题，不剧透后续
- 末附题型标签如 [BQ-领导力]、[DEEP-简历深挖]、[CASE-产品设计]`;
}

/** 按轮次生成一道面试题（实时调用 LLM） */
async function generateRoundQuestion(
  context: InterviewContext,
  round: RoundDef,
  questionIndex: number,
  questionHistory: string[],
  isTransition: boolean,
  previousRound?: RoundDef,
  onToken?: (t: string) => void,
): Promise<{ questionText: string; category: string; subCategory: string }> {
  const systemPrompt = buildRoundPrompt(context, round, questionIndex, questionHistory, isTransition, previousRound);

  const userPrompt = isTransition
    ? `请过渡到「${round.name}」轮次，出本轮第1题。`
    : `请出「${round.name}」轮次的第 ${questionIndex} 题。${questionIndex === 1 && !isTransition ? '先用1-2句开场/过渡，然后出题。' : ''}`;

  let fullText = '';
  await chatStream(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    (token) => { fullText += token; if (onToken) onToken(token); },
    () => {},
    (err) => { throw err; },
  );

  const parsed = parseQuestionTag(fullText);
  return {
    questionText: parsed?.question || fullText,
    category: parsed?.category || (round.slug === 'behavioral' ? 'BQ' : round.slug === 'case_design' ? 'CASE' : 'GEN'),
    subCategory: parsed?.subCategory || '',
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
  const intensityGuide = intensity === 'bar_raiser'
    ? '你是 Bar-raiser，专找逻辑漏洞，追问要尖锐直接："你说的这个数字怎么来的？谁定的标准？如果换个做法会怎样？"'
    : intensity === 'mild'
      ? '你是温和 HR，追问要礼貌克制，点到为止。'
      : '你是深挖技术面试官，沿技术细节往下钻。';

  const followUpPrompt = `刚才题目：[${currentQ.category}] ${currentQ.question_text}\n候选人回答：${answer}\n\n${intensityGuide}\n作为 INTERVIEWER，请锁定当前题目涉及的简历动作，沿"工具→量级→你的判断→成果"方向进行追问。${context.resumeContext ? '不要切换到别的经历。' : ''}`;

  let fullText = '';
  await chatStream(
    [{ role: 'system', content: `${SYSTEM_PERSONA}\n${INTERVIEWER_DEEPDIVE_PROMPT}` }, { role: 'user', content: followUpPrompt }],
    (token) => { fullText += token; onToken(token); },
    () => {},
    (err) => { throw err; },
  );
  return fullText;
}

// ═══════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════

export async function streamInterviewChat(
  context: InterviewContext,
  request: { action: string; message?: string; confidence?: number; intensity?: string; feedbackMode?: string },
  onEvent: (event: { type: string; data: Record<string, unknown> }) => void,
): Promise<void> {
  const { action, message, confidence, intensity, feedbackMode } = request;
  const settings: InterviewSettings = {
    intensity: (intensity as 'mild' | 'deep' | 'bar_raiser') || 'deep',
    feedbackMode: (feedbackMode as 'practice' | 'exam') || 'practice',
  };
  const hasResume = !!(context.resumeContext);

  const existingQuestions = db().select().from(interviewQuestions)
    .where(eq(interviewQuestions.session_id, context.sessionId))
    .orderBy(sql`sequence ASC`).all();

  const questionHistory = existingQuestions.map(
    q => `[${q.category}${q.sub_category ? '-' + q.sub_category : ''}] ${q.question_text}`,
  );

  // ═══════════════════════════════════════
  // START — 直接开始 PHASE 1 第一轮第一题
  // ═══════════════════════════════════════
  if (action === 'start' || existingQuestions.length === 0) {
    const { round, questionIndex } = determineNextRound(existingQuestions, hasResume);

    try {
      const { questionText, category, subCategory } = await generateRoundQuestion(
        context, round, questionIndex, questionHistory, false,
        undefined,
        (token) => onEvent({ type: 'token', data: { text: token } }),
      );

      const qId = uuidv4();
      db().insert(interviewQuestions).values({
        id: qId, session_id: context.sessionId,
        question_text: questionText,
        category: category as QuestionCategory,
        sub_category: subCategory as QuestionSubCategory,
        sequence: 1,
        feedback: JSON.stringify({ round: round.name, roundSlug: round.slug, roundIndex: 1, hasResume }),
      }).run();
      saveDb();

      onEvent({ type: 'question', data: {
        question_id: qId,
        category: `${category}${subCategory ? '-' + subCategory : ''}`,
        text: questionText,
        sequence: 1,
        round: round.name,
      }});
      onEvent({ type: 'done', data: { question_id: qId } });
    } catch (err: any) {
      onEvent({ type: 'error', data: { message: err.message } });
    }
    return;
  }

  // ═══════════════════════════════════════
  // ANSWER — 用户作答 → 深挖追问 or 换题信号
  // ═══════════════════════════════════════
  if (action === 'answer' && message) {
    const currentQ = existingQuestions[existingQuestions.length - 1];
    if (!currentQ) {
      onEvent({ type: 'error', data: { message: '没有当前题目' } });
      return;
    }

    const updateData: Record<string, unknown> = { user_answer: message };
    const currentFb = (() => { try { return JSON.parse(currentQ.feedback || '{}'); } catch { return {}; } })();
    if (confidence !== undefined) {
      currentFb.confidence = confidence;
    }
    updateData.feedback = JSON.stringify(currentFb);
    db().update(interviewQuestions).set(updateData).where(eq(interviewQuestions.id, currentQ.id)).run();
    saveDb();

    const deepDiveThreshold = settings.intensity === 'bar_raiser'
      ? 600 : settings.intensity === 'mild' ? 150 : 400;

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
  // NEXT — 实时生成下一题（按轮次规则）
  // ═══════════════════════════════════════
  if (action === 'next_question') {
    const { round, questionIndex, isTransition, previousRound } = determineNextRound(existingQuestions, hasResume);
    const sequence = existingQuestions.length + 1;

    try {
      const { questionText, category, subCategory } = await generateRoundQuestion(
        context, round, questionIndex, questionHistory, isTransition, previousRound,
        (token) => onEvent({ type: 'token', data: { text: token } }),
      );

      const qId = uuidv4();
      db().insert(interviewQuestions).values({
        id: qId, session_id: context.sessionId,
        question_text: questionText,
        category: category as QuestionCategory,
        sub_category: subCategory as QuestionSubCategory,
        sequence,
        feedback: JSON.stringify({ round: round.name, roundSlug: round.slug, roundIndex: questionIndex, hasResume }),
      }).run();
      saveDb();

      onEvent({ type: 'question', data: {
        question_id: qId,
        category: `${category}${subCategory ? '-' + subCategory : ''}`,
        text: questionText,
        sequence,
        round: round.name,
        roundIndex: questionIndex,
        isTransition,
      }});
      onEvent({ type: 'done', data: { question_id: qId } });
    } catch (err: any) {
      onEvent({ type: 'error', data: { message: err.message } });
    }
    return;
  }

  // ═══════════════════════════════════════
  // RATE — 对上一题单独评分
  // ═══════════════════════════════════════
  if (action === 'rate_last') {
    const currentQ = existingQuestions[existingQuestions.length - 1];
    if (!currentQ?.user_answer) {
      onEvent({ type: 'done', data: {} });
      return;
    }

    const confNote = (() => { try { return JSON.parse(currentQ.feedback || '{}').confidence; } catch { return undefined; } })();
    const scoringPrompt = `${ASSESSOR_SCORING_PROMPT}\n\n题目：[${currentQ.category}] ${currentQ.question_text}\n候选人回答：${currentQ.user_answer}${confNote ? `\n自评信心：${confNote}/5` : ''}\n\n请评分并给出简短反馈。`;

    try {
      let fullText = '';
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
