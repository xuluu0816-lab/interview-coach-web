/**
 * 复盘评分服务 — 对面试回答进行4维度评分
 */
import { chatJSON } from './client';
import { REVIEWER_PROMPT, SYSTEM_PERSONA } from './prompts';
import { db, saveDb, sessions, interviewQuestions } from '../../db';
import { eq, and, sql } from 'drizzle-orm';
import type {
  ReviewReport, ReviewedQuestion, QuestionFeedback,
  ProgressReport, ScoreGrade, CategoryStat, RecentSession, WeakArea,
} from '../../types';

export async function reviewSingleQuestion(question: {
  id: string; question_text: string; category: string; user_answer: string;
}): Promise<{ scores: Record<string, number>; total: number; grade: ScoreGrade; answer_summary: string; feedback: QuestionFeedback }> {
  const messages = [
    { role: 'system' as const, content: SYSTEM_PERSONA },
    { role: 'user' as const, content: REVIEWER_PROMPT({ question_text: question.question_text, category: question.category, user_answer: question.user_answer }) },
  ];
  const result = await chatJSON<{
    scores: { structure: number; content: number; clarity: number; highlight: number };
    total: number; grade: string; answer_summary: string; strengths: string[];
    improvements: { title: string; detail: string; example: string }[];
    model_answer: { situation: string; task: string; action: string; result: string };
  }>(messages, { temperature: 0.2 });

  return {
    scores: result.scores, total: result.total, grade: result.grade as ScoreGrade,
    answer_summary: result.answer_summary,
    feedback: { strengths: result.strengths || [], improvements: (result.improvements || []).slice(0, 3), model_answer: result.model_answer },
  };
}

export async function generateReviewReport(sessionId: string): Promise<ReviewReport> {
  const questions = db().select().from(interviewQuestions)
    .where(and(eq(interviewQuestions.session_id, sessionId), sql`${interviewQuestions.user_answer} IS NOT NULL AND ${interviewQuestions.user_answer} != ''`))
    .orderBy(sql`sequence ASC`).all();

  const reviewedQuestions: ReviewedQuestion[] = [];
  let totalScore = 0;
  let scoredCount = 0;

  for (const q of questions) {
    if (!q.user_answer) continue;
    const review = await reviewSingleQuestion({ id: q.id, question_text: q.question_text, category: q.category, user_answer: q.user_answer });

    db().update(interviewQuestions).set({
      score_structure: review.scores.structure, score_content: review.scores.content,
      score_clarity: review.scores.clarity, score_highlight: review.scores.highlight,
      total_score: review.total, answer_summary: review.answer_summary, feedback: JSON.stringify(review.feedback),
    }).where(eq(interviewQuestions.id, q.id)).run();
    saveDb();

    reviewedQuestions.push({
      question_text: q.question_text, category: q.category as any, sub_category: q.sub_category as any,
      user_answer_summary: review.answer_summary,
      scores: { structure: review.scores.structure, content: review.scores.content, clarity: review.scores.clarity, highlight: review.scores.highlight },
      total: review.total, feedback: review.feedback,
    });
    totalScore += review.total;
    scoredCount++;
  }

  const overallScore = scoredCount > 0 ? totalScore / scoredCount : 0;
  let grade: ScoreGrade;
  if (overallScore >= 35) grade = 'Excellent';
  else if (overallScore >= 28) grade = 'Great';
  else if (overallScore >= 21) grade = 'Good';
  else if (overallScore >= 14) grade = 'Needs Work';
  else grade = 'Retrain';

  let scoreBand: string;
  if (overallScore >= 35) scoreBand = '35-40';
  else if (overallScore >= 28) scoreBand = '28-34';
  else if (overallScore >= 21) scoreBand = '21-27';
  else if (overallScore >= 14) scoreBand = '14-20';
  else scoreBand = '0-13';

  return {
    session_id: sessionId, overall_score: Math.round(overallScore * 10) / 10, grade, score_band: scoreBand,
    questions: reviewedQuestions, overall_feedback: generateOverallFeedback(reviewedQuestions, grade),
  };
}

function generateOverallFeedback(questions: ReviewedQuestion[], grade: ScoreGrade): string {
  if (questions.length === 0) return '暂无答题记录。';
  const dimScores = { structure: 0, content: 0, clarity: 0, highlight: 0 };
  questions.forEach(q => { dimScores.structure += q.scores.structure; dimScores.content += q.scores.content; dimScores.clarity += q.scores.clarity; dimScores.highlight += q.scores.highlight; });
  const weakest = Object.entries(dimScores).sort((a, b) => a[1] - b[1])[0];
  const dimNames: Record<string, string> = { structure: '结构完整性', content: '内容深度', clarity: '表达清晰度', highlight: '亮点加分' };
  const suggestions: Record<ScoreGrade, string> = {
    'Excellent': '表现非常出色！建议继续保持，挑战更高难度题目。',
    'Great': '表现不错！重点关注' + dimNames[weakest[0]] + '的提升。',
    'Good': '具备基本能力，在' + dimNames[weakest[0]] + '方面还有提升空间。',
    'Needs Work': '有一些短板需要补齐，建议从STAR法则基础练习开始。',
    'Retrain': '不要灰心！建议先学习STAR法则和常见面试框架。',
  };
  return suggestions[grade] || suggestions['Good'];
}

export async function generateProgressReport(userId: string): Promise<ProgressReport> {
  const userSessions = db().select().from(sessions)
    .where(and(eq(sessions.user_id, userId), eq(sessions.status, 'completed'))).all();
  const sessionIds = userSessions.map(s => s.id);

  if (sessionIds.length === 0) return {
    total_sessions: 0, total_questions: 0, avg_score: 0, max_score: 0, min_score: 0,
    trend: 'FLAT', by_category: [], recent_sessions: [], weak_areas: [],
    overall_suggestion: '还没有面试练习记录。现在就开始第一次模拟面试吧！',
  };

  const allQuestions = db().select().from(interviewQuestions)
    .where(and(sql`${interviewQuestions.session_id} IN (${sessionIds.map(() => '?').join(',')})`, sql`${interviewQuestions.total_score} IS NOT NULL`)).all();

  const allScores = allQuestions.map(q => q.total_score!).filter(s => s > 0);
  const avgScore = allScores.length > 0 ? allScores.reduce((s, a) => s + a, 0) / allScores.length : 0;
  const maxScore = allScores.length > 0 ? Math.max(...allScores) : 0;
  const minScore = allScores.length > 0 ? Math.min(...allScores) : 0;

  const categoryMap = new Map<string, { count: number; totalScore: number; maxScore: number }>();
  for (const q of allQuestions) {
    const cat = q.category || '未分类';
    const entry = categoryMap.get(cat) || { count: 0, totalScore: 0, maxScore: 0 };
    entry.count++; entry.totalScore += q.total_score || 0; entry.maxScore = Math.max(entry.maxScore, q.total_score || 0);
    categoryMap.set(cat, entry);
  }

  const byCategory: CategoryStat[] = Array.from(categoryMap.entries()).map(([cat, stats]) => ({
    category: cat, count: stats.count, avg_score: stats.count > 0 ? Math.round((stats.totalScore / stats.count) * 10) / 10 : 0, max_score: stats.maxScore,
  }));

  const recentSessions = userSessions.slice(-5);
  const recentIds = recentSessions.map(s => s.id);
  const recentQs = allQuestions.filter(q => recentIds.includes(q.session_id));
  const recentScores = recentQs.map(q => q.total_score!).filter(s => s > 0);
  const recentAvg = recentScores.length > 0 ? recentScores.reduce((s, a) => s + a, 0) / recentScores.length : 0;
  const trend = recentAvg > avgScore ? 'UP' : recentAvg < avgScore ? 'DOWN' : 'FLAT';

  const weakAreas: WeakArea[] = byCategory.filter(c => c.avg_score < 24).map(c => ({
    category: c.category, avg_score: c.avg_score,
    suggestion: c.avg_score < 14 ? '建议从框架基础开始学习' : c.avg_score < 21 ? '建议增加练习量' : '建议追求更深的内容和亮点',
  }));

  return {
    total_sessions: userSessions.length, total_questions: allQuestions.length,
    avg_score: Math.round(avgScore * 10) / 10, max_score: maxScore, min_score: minScore, trend,
    by_category: byCategory,
    recent_sessions: recentSessions.map(s => ({ date: s.created_at, company: s.company || '未指定', role: s.role || '未指定', question_count: allQuestions.filter(q => q.session_id === s.id).length })),
    weak_areas: weakAreas,
    overall_suggestion: weakAreas.length > 0 ? `重点加强：${weakAreas.map(w => w.category).join('、')}` : '各题型表现均衡，继续保持！',
  };
}
