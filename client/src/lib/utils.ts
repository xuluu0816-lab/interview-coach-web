import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { QuestionCategory } from '@/types';

/** 合并 TailwindCSS class，正确处理冲突 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 格式化日期 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** 格式化时间为相对时间 */
export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return formatDate(dateStr);
}

/** 评分等级对应的颜色 */
export function gradeColor(grade: string): string {
  const map: Record<string, string> = {
    'Excellent': 'text-green-600 bg-green-50',
    'Great': 'text-blue-600 bg-blue-50',
    'Good': 'text-yellow-600 bg-yellow-50',
    'Needs Work': 'text-orange-600 bg-orange-50',
    'Retrain': 'text-red-600 bg-red-50',
  };
  return map[grade] || 'text-gray-600 bg-gray-50';
}

/** 评分等级中文 */
export function gradeLabel(grade: string): string {
  const map: Record<string, string> = {
    'Excellent': '卓越',
    'Great': '优秀',
    'Good': '良好',
    'Needs Work': '待提升',
    'Retrain': '需重练',
  };
  return map[grade] || grade;
}

/** 投递状态中文 */
export function appStatusLabel(status: string): string {
  const map: Record<string, string> = {
    'applied': '已投递',
    'screening': '简历筛选',
    'written': '笔试',
    'interview1': '一面',
    'interview2': '二面',
    'hr': 'HR面',
    'offer': 'Offer',
    'rejected': '未通过',
  };
  return map[status] || status;
}

/** 投递状态颜色 */
export function appStatusColor(status: string): string {
  const map: Record<string, string> = {
    'applied': 'bg-gray-100 text-gray-700',
    'screening': 'bg-blue-100 text-blue-700',
    'written': 'bg-purple-100 text-purple-700',
    'interview1': 'bg-yellow-100 text-yellow-700',
    'interview2': 'bg-orange-100 text-orange-700',
    'hr': 'bg-indigo-100 text-indigo-700',
    'offer': 'bg-green-100 text-green-700',
    'rejected': 'bg-red-100 text-red-700',
  };
  return map[status] || 'bg-gray-100 text-gray-700';
}

/** 经验水平中文 */
export function levelLabel(level: string): string {
  const map: Record<string, string> = {
    'entry': '校招/应届',
    '1-3y': '1-3年',
    '3-5y': '3-5年',
    '5y+': '5年以上',
  };
  return map[level] || level;
}

/** 题型中文 */
export function categoryLabel(cat: QuestionCategory): string {
  const map: Record<string, string> = {
    'BQ': '行为面试',
    'CASE': '案例分析',
    'GEN': '通用面试',
  };
  return map[cat] || cat;
}

