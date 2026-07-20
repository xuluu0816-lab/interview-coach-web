import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { QuestionCategory, ApplicationStage } from '@/types';

/** 合并 TailwindCSS class */
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

/** 格式化日期 */
export function formatDate(dateStr: string): string { return new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }); }

/** 相对时间 */
export function timeAgo(dateStr: string): string { const diff = Date.now() - new Date(dateStr).getTime(); const mins = Math.floor(diff / 60000); if (mins < 1) return '刚刚'; if (mins < 60) return `${mins}分钟前`; const hours = Math.floor(mins / 60); if (hours < 24) return `${hours}小时前`; return formatDate(dateStr); }

/** 评分等级颜色 */
export function gradeColor(grade: string): string { const m: Record<string, string> = { Excellent: 'text-green-600 bg-green-50', Great: 'text-blue-600 bg-blue-50', Good: 'text-yellow-600 bg-yellow-50', 'Needs Work': 'text-orange-600 bg-orange-50', Retrain: 'text-red-600 bg-red-50' }; return m[grade] || 'text-gray-600 bg-gray-50'; }

/** 评分等级中文 */
export function gradeLabel(grade: string): string { const m: Record<string, string> = { Excellent: '卓越', Great: '优秀', Good: '良好', 'Needs Work': '待提升', Retrain: '需重练' }; return m[grade] || grade; }

/** 经验水平中文 */
export function levelLabel(level: string): string { const m: Record<string, string> = { 'entry': '校招/应届', '1-3y': '1-3年', '3-5y': '3-5年', '5y+': '5年以上' }; return m[level] || level; }

/** 题型中文 */
export function categoryLabel(cat: QuestionCategory): string { const m: Record<string, string> = { BQ: '行为面试', CASE: '案例分析', GEN: '通用面试' }; return m[cat] || cat; }

// ===== 模块3: 6阶段投递追踪 =====

export function stageLabel(stage: ApplicationStage): string { const m: Record<ApplicationStage, string> = { resume_screening: '简历筛选', written_test: '笔试', ai_interview: 'AI面试', first_round: '一面', second_round: '二面', final: '终面' }; return m[stage]; }

export function stageColor(stage: ApplicationStage): string { const m: Record<ApplicationStage, string> = { resume_screening: 'bg-gray-100 text-gray-700', written_test: 'bg-blue-100 text-blue-700', ai_interview: 'bg-purple-100 text-purple-700', first_round: 'bg-yellow-100 text-yellow-700', second_round: 'bg-orange-100 text-orange-700', final: 'bg-green-100 text-green-700' }; return m[stage]; }

export function stageStatusLabel(status: string): string { const m: Record<string, string> = { pending: '待进行', current: '进行中', passed: '已通过', skipped: '已跳过' }; return m[status] || status; }

export function stageStatusColor(status: string): string { const m: Record<string, string> = { pending: 'text-gray-400', current: 'text-blue-600 font-semibold', passed: 'text-green-600', skipped: 'text-gray-400 line-through' }; return m[status] || 'text-gray-400'; }

// ===== 模块4: 岗位类型 =====

export function jobTypeLabel(jt: string): string { const m: Record<string, string> = { campus: '校招', internship: '实习', fulltime: '社招' }; return m[jt] || jt; }
