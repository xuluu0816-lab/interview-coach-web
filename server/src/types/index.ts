// ========== 面试相关类型 ==========

/** 面试经验水平 */
export type ExperienceLevel = 'entry' | '1-3y' | '3-5y' | '5y+';

/** 面试会话状态 */
export type SessionStatus = 'active' | 'completed' | 'archived';

/** 题目主分类 */
export type QuestionCategory = 'BQ' | 'CASE' | 'GEN';

/** 题目子分类 */
export type QuestionSubCategory =
  // BQ 子类
  | 'leadership' | 'conflict' | 'failure' | 'teamwork' | 'creativity' | 'pressure'
  // CASE 子类
  | 'market' | 'product' | 'strategy'
  // GEN 子类
  | 'self_intro' | 'career_motivation' | 'personal_traits' | 'situational';

/** 题目难度 */
export type QuestionDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** 投递状态 */
export type ApplicationStatus =
  | 'applied' | 'screening' | 'written'
  | 'interview1' | 'interview2' | 'hr'
  | 'offer' | 'rejected';

/** 岗位类型 */
export type JobType = 'campus' | 'internship' | 'fulltime';

/** 文件类型 */
export type FileType = 'txt' | 'pdf' | 'docx' | 'png' | 'jpg' | 'mp3' | 'mp4';

/** 分析类型 */
export type AnalysisType = 'resume' | 'jd' | 'interview_review';

/** Chat 动作 */
export type ChatAction = 'start' | 'answer' | 'skip' | 'next_question';

// ========== 评分相关类型 ==========

/** 4维度评分 */
export interface Scores {
  structure: number;  // 结构完整性 1-10
  content: number;    // 内容深度 1-10
  clarity: number;    // 表达清晰度 1-10
  highlight: number;  // 亮点加分 1-10
}

/** 评分等级 */
export type ScoreGrade = 'Excellent' | 'Great' | 'Good' | 'Needs Work' | 'Retrain';

/** 改进建议 */
export interface Improvement {
  title: string;
  detail: string;
  example: string;
}

/** STAR 框架 */
export interface StarFramework {
  situation: string;
  task: string;
  action: string;
  result: string;
}

/** 题目的完整反馈 */
export interface QuestionFeedback {
  strengths: string[];
  improvements: Improvement[];
  model_answer: StarFramework;
}

// ========== 数据库记录类型 ==========

/** 用户 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

/** 面试会话 */
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

/** 面试题目记录 */
export interface InterviewQuestion {
  id: string;
  session_id: string;
  question_text: string;
  category: QuestionCategory;
  sub_category: QuestionSubCategory | null;
  user_answer: string | null;
  answer_summary: string | null;
  score_structure: number | null;
  score_content: number | null;
  score_clarity: number | null;
  score_highlight: number | null;
  total_score: number | null;
  feedback: string | null; // JSON string of QuestionFeedback
  sequence: number;
  created_at: string;
}

/** 题库 */
export interface QuestionBankItem {
  id: string;
  category: QuestionCategory;
  sub_category: QuestionSubCategory;
  difficulty: QuestionDifficulty;
  question_text: string;
  tips: string | null;
}

/** 投递记录 */
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

/** 岗位信息 */
export interface JobListing {
  id: string;
  company: string;
  position: string;
  city: string | null;
  description: string | null;
  requirements: string | null;
  salary: string | null;
  job_type: JobType | null;
  source_url: string | null;
  deadline: string | null;
  source: string | null;
  created_at: string;
}

/** 上传文件 */
export interface UploadedFile {
  id: string;
  user_id: string;
  filename: string;
  file_type: FileType;
  file_size: number | null;
  parsed_text: string | null;
  analysis: string | null; // JSON string
  created_at: string;
}

// ========== API 请求/响应类型 ==========

/** 创建会话请求 */
export interface CreateSessionRequest {
  company?: string;
  role?: string;
  level?: ExperienceLevel;
}

/** Chat 请求 */
export interface ChatRequest {
  action: ChatAction;
  message?: string;
}

/** Chat SSE 事件 */
export interface ChatSSEEvent {
  type: 'token' | 'question' | 'quick_feedback' | 'done' | 'error';
  data: Record<string, unknown>;
}

/** 复盘报告 */
export interface ReviewReport {
  session_id: string;
  overall_score: number;
  grade: ScoreGrade;
  score_band: string;
  questions: ReviewedQuestion[];
  overall_feedback: string;
}

/** 复盘单题 */
export interface ReviewedQuestion {
  question_text: string;
  category: QuestionCategory;
  sub_category: QuestionSubCategory | null;
  user_answer_summary: string;
  scores: Scores;
  total: number;
  feedback: QuestionFeedback;
}

/** 进度报告 */
export interface ProgressReport {
  total_sessions: number;
  total_questions: number;
  avg_score: number;
  max_score: number;
  min_score: number;
  trend: 'UP' | 'DOWN' | 'FLAT';
  by_category: CategoryStat[];
  recent_sessions: RecentSession[];
  weak_areas: WeakArea[];
  overall_suggestion: string;
}

export interface CategoryStat {
  category: string;
  count: number;
  avg_score: number;
  max_score: number;
}

export interface RecentSession {
  date: string;
  company: string;
  role: string;
  question_count: number;
}

export interface WeakArea {
  category: string;
  avg_score: number;
  suggestion: string;
}

/** 文件分析请求 */
export interface AnalyzeRequest {
  analysis_type: AnalysisType;
}

/** 简历分析结果 */
export interface ResumeAnalysis {
  personal_info: {
    name?: string;
    email?: string;
    phone?: string;
    education?: string;
  };
  experiences: {
    company: string;
    role: string;
    duration: string;
    highlights: string[];
  }[];
  skills: string[];
  star_materials: {
    situation: string;
    task: string;
    action: string;
    result: string;
    usable_for: string[];
  }[];
}

/** JD 分析结果 */
export interface JdAnalysis {
  core_requirements: string[];
  skill_checklist: string[];
  culture_fit_clues: string[];
  interview_focus: string[];
  resume_match_tips: string;
}
