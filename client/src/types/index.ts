// 全局类型定义 — 与 server/src/types/index.ts 对应

// ========== 枚举类型 ==========
export type ExperienceLevel = 'entry' | '1-3y' | '3-5y' | '5y+';
export type SessionStatus = 'active' | 'completed' | 'archived';
export type QuestionCategory = 'BQ' | 'CASE' | 'GEN';
export type QuestionDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type ApplicationStatus =
  | 'applied' | 'screening' | 'written' | 'interview1' | 'interview2'
  | 'hr' | 'offer' | 'rejected';
export type AnalysisType = 'resume' | 'jd' | 'interview_review';
export type ScoreGrade = 'Excellent' | 'Great' | 'Good' | 'Needs Work' | 'Retrain';

// ========== 评分相关 ==========
export interface Scores {
  structure: number;
  content: number;
  clarity: number;
  highlight: number;
}

export interface Improvement {
  title: string;
  detail: string;
  example: string;
}

export interface StarFramework {
  situation: string;
  task: string;
  action: string;
  result: string;
}

export interface QuestionFeedback {
  strengths: string[];
  improvements: Improvement[];
  model_answer: StarFramework;
}

// ========== 数据库记录 ==========
export interface Session {
  id: string;
  user_id: string;
  company: string | null;
  role: string | null;
  level: ExperienceLevel | null;
  status: SessionStatus;
  created_at: string;
  completed_at: string | null;
}

export interface InterviewQuestion {
  id: string;
  session_id: string;
  question_text: string;
  category: QuestionCategory;
  sub_category: string | null;
  user_answer: string | null;
  answer_summary: string | null;
  score_structure: number | null;
  score_content: number | null;
  score_clarity: number | null;
  score_highlight: number | null;
  total_score: number | null;
  feedback: string | null;
  sequence: number;
  created_at: string;
}

export interface QuestionBankItem {
  id: string;
  category: QuestionCategory;
  sub_category: string;
  difficulty: QuestionDifficulty;
  question_text: string;
  tips: string | null;
}

export interface Application {
  id: string;
  user_id: string;
  company: string;
  position: string;
  city: string | null;
  applied_at: string | null;
  status: ApplicationStatus;
  notes: string | null;
  url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadedFile {
  id: string;
  user_id: string;
  filename: string;
  file_type: string;
  file_size: number | null;
  parsed_text: string | null;
  parsed_text_preview?: string;
  analysis: string | null;
  created_at: string;
}

// ========== API 响应 ==========
export interface ReviewedQuestion {
  question_text: string;
  category: QuestionCategory;
  sub_category: string | null;
  user_answer_summary: string;
  scores: Scores;
  total: number;
  feedback: QuestionFeedback;
}

export interface ReviewReport {
  session_id: string;
  overall_score: number;
  grade: ScoreGrade;
  score_band: string;
  questions: ReviewedQuestion[];
  overall_feedback: string;
}

export interface ProgressReport {
  total_sessions: number;
  total_questions: number;
  avg_score: number;
  max_score: number;
  min_score: number;
  trend: 'UP' | 'DOWN' | 'FLAT';
  by_category: { category: string; count: number; avg_score: number; max_score: number }[];
  recent_sessions: { date: string; company: string; role: string; question_count: number }[];
  weak_areas: { category: string; avg_score: number; suggestion: string }[];
  overall_suggestion: string;
}

export interface ResumeAnalysis {
  personal_info: Record<string, string | undefined>;
  experiences: { company: string; role: string; duration: string; highlights: string[] }[];
  skills: string[];
  star_materials: { situation: string; task: string; action: string; result: string; usable_for: string[] }[];
}

export interface JdAnalysis {
  core_requirements: string[];
  skill_checklist: string[];
  culture_fit_clues: string[];
  interview_focus: string[];
  resume_match_tips: string;
}

// ========== 聊天消息 ==========
export interface ChatMessage {
  role: 'interviewer' | 'user' | 'system';
  content: string;
  category?: string;
  isQuestion?: boolean;
}

// ========== 面试配置表单 ==========
export interface InterviewConfig {
  company: string;
  role: string;
  level: ExperienceLevel;
  questionTypes: QuestionCategory[];
}
