// ========== 枚举类型 ==========
export type ExperienceLevel = 'entry' | '1-3y' | '3-5y' | '5y+';
export type SessionStatus = 'active' | 'completed' | 'archived';
export type QuestionCategory = 'BQ' | 'CASE' | 'GEN';
export type QuestionDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type ScoreGrade = 'Excellent' | 'Great' | 'Good' | 'Needs Work' | 'Retrain';

// ========== 评分相关 ==========
export interface Scores { structure: number; content: number; clarity: number; highlight: number; }
export interface Improvement { title: string; detail: string; example: string; }
export interface StarFramework { situation: string; task: string; action: string; result: string; }
export interface QuestionFeedback { strengths: string[]; improvements: Improvement[]; model_answer: StarFramework; }

// ========== 数据库记录 ==========
export interface Session { id: string; user_id: string; company: string | null; role: string | null; level: ExperienceLevel | null; status: SessionStatus; created_at: string; completed_at: string | null; }
export interface InterviewQuestion { id: string; session_id: string; question_text: string; category: QuestionCategory; sub_category: string | null; user_answer: string | null; answer_summary: string | null; score_structure: number | null; score_content: number | null; score_clarity: number | null; score_highlight: number | null; total_score: number | null; feedback: string | null; sequence: number; created_at: string; }
export interface QuestionBankItem { id: string; category: QuestionCategory; sub_category: string; difficulty: QuestionDifficulty; question_text: string; tips: string | null; }
export interface Application { id: string; user_id: string; company: string; position: string; city: string | null; applied_at: string | null; status: string; notes: string | null; url: string | null; created_at: string; updated_at: string; }
export interface UploadedFile { id: string; user_id: string; filename: string; file_type: string; file_size: number | null; parsed_text: string | null; parsed_text_preview?: string; analysis: string | null; created_at: string; }
export type AnalysisType = 'resume' | 'jd' | 'interview_review';

// ========== API 响应 ==========
export interface ReviewedQuestion { question_text: string; category: QuestionCategory; sub_category: string | null; user_answer_summary: string; scores: Scores; total: number; feedback: QuestionFeedback; }
export interface ReviewReport { session_id: string; overall_score: number; grade: ScoreGrade; score_band: string; questions: ReviewedQuestion[]; overall_feedback: string; }
export interface ProgressReport { total_sessions: number; total_questions: number; avg_score: number; max_score: number; min_score: number; trend: 'UP' | 'DOWN' | 'FLAT'; by_category: { category: string; count: number; avg_score: number; max_score: number }[]; recent_sessions: { date: string; company: string; role: string; question_count: number }[]; weak_areas: { category: string; avg_score: number; suggestion: string }[]; overall_suggestion: string; }
export interface ResumeAnalysis { personal_info: Record<string, string | undefined>; experiences: { company: string; role: string; duration: string; highlights: string[] }[]; skills: string[]; star_materials: { situation: string; task: string; action: string; result: string; usable_for: string[] }[]; }
export interface JdAnalysis { core_requirements: string[]; skill_checklist: string[]; culture_fit_clues: string[]; interview_focus: string[]; resume_match_tips: string; }

// ========== 聊天消息 ==========
export interface ChatMessage { role: 'interviewer' | 'user' | 'system'; content: string; category?: string; isQuestion?: boolean; }
export interface InterviewConfig { company: string; role: string; level: ExperienceLevel; questionTypes: QuestionCategory[]; }

// ===== 模块1: 面试预习+复盘 =====
export interface CompanyFramework { overview: string; businessLines: string[]; competitors: string[]; recentNews: string[]; culture: string; interviewStyle: string; }
export interface BusinessQuestion { id: string; scenario: string; question: string; category: string; referenceAnswer: string; }
export interface JdPrepResult { companyFramework: CompanyFramework; businessQuestions: BusinessQuestion[]; generatedAt: string; }
export interface RecordingFile { id: string; filename: string; fileType: 'mp3' | 'mp4' | 'wav'; fileSize: number; duration?: number; status: 'uploading' | 'transcribing' | 'completed' | 'error'; transcription?: string; questions?: ExtractedQuestion[]; report?: ReviewReport; }
export interface ExtractedQuestion { index: number; timestamp?: string; questionText: string; answerText?: string; interviewerNotes?: string; }

// ===== 模块2: AI模拟面试 =====
export interface MockInterviewConfig { jdFileId?: string; resumeFileId?: string; jdText?: string; resumeText?: string; mode: 'deep_dive' | 'cross_scenario' | 'mixed'; questionCount: number; language: 'zh' | 'en'; }
export interface RealTimeFeedback { questionId: string; scores: Scores; total: number; quickTips: string; deepDiveSuggestion?: string; }

// ===== 模块3: 投递追踪（7阶段） =====
export type ApplicationStage = 'resume_submitted' | 'written_test' | 'ai_interview' | 'first_round' | 'second_round' | 'third_round' | 'final';
export const APP_STAGES: ApplicationStage[] = ['resume_submitted', 'written_test', 'ai_interview', 'first_round', 'second_round', 'third_round', 'final'];
export const STAGE_OPTIONS: { value: ApplicationStage; label: string }[] = [
  { value: 'resume_submitted', label: '简历投递' },
  { value: 'written_test', label: '笔试' },
  { value: 'ai_interview', label: 'AI面试' },
  { value: 'first_round', label: '一面' },
  { value: 'second_round', label: '二面' },
  { value: 'third_round', label: '三面' },
  { value: 'final', label: '终面' },
];
export interface StageInfo { stage: ApplicationStage; status: 'pending' | 'current' | 'passed' | 'skipped'; timestamp?: string; notes?: string; score?: number; }
export interface ApplicationV2 { id: string; company: string; position: string; city?: string; currentStage: ApplicationStage; stages: StageInfo[]; appliedAt?: string; url?: string; notes?: string; updatedAt: string; }

// ===== 模块4: 实时岗位 =====
export interface ExternalJob { id: string; company: string; position: string; city: string; jobType: 'campus' | 'internship' | 'fulltime'; salary?: string; description?: string; requirements?: string; deadline?: string; link?: string; postedAt?: string; source: string; isSaved: boolean; }
export interface JobFilters { keyword?: string; company?: string; city?: string; jobType?: string; }
