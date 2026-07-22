import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ========== 用户表 ==========
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatar_url: text('avatar_url'),
  created_at: text('created_at').default("(datetime('now'))").notNull(),
});

// ========== 面试会话表 ==========
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  user_id: text('user_id').references(() => users.id).notNull(),
  company: text('company'),
  role: text('role'),
  level: text('level'), // entry | 1-3y | 3-5y | 5y+
  jd_text: text('jd_text'),
  resume_text: text('resume_text'),
  status: text('status').default('active').notNull(), // active | completed | archived
  created_at: text('created_at').default("(datetime('now'))").notNull(),
  completed_at: text('completed_at'),
});

// ========== 面试题目记录表 ==========
export const interviewQuestions = sqliteTable('interview_questions', {
  id: text('id').primaryKey(),
  session_id: text('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  question_text: text('question_text').notNull(),
  category: text('category').notNull(), // BQ | CASE | GEN
  sub_category: text('sub_category'),
  user_answer: text('user_answer'),
  answer_summary: text('answer_summary'),
  score_structure: integer('score_structure'), // 1-10
  score_content: integer('score_content'),     // 1-10
  score_clarity: integer('score_clarity'),     // 1-10
  score_highlight: integer('score_highlight'), // 1-10
  total_score: integer('total_score'),         // 满分40
  feedback: text('feedback'),                  // JSON string
  sequence: integer('sequence').notNull(),
  created_at: text('created_at').default("(datetime('now'))").notNull(),
});

// ========== 题库表（种子数据：60题） ==========
export const questionBank = sqliteTable('question_bank', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),       // BQ | CASE | GEN
  sub_category: text('sub_category').notNull(),
  difficulty: text('difficulty').notNull(),   // beginner | intermediate | advanced
  question_text: text('question_text').notNull(),
  tips: text('tips'),
});

// ========== 投递记录表 ==========
export const applications = sqliteTable('applications', {
  id: text('id').primaryKey(),
  user_id: text('user_id').references(() => users.id).notNull(),
  company: text('company').notNull(),
  position: text('position').notNull(),
  city: text('city'),
  applied_at: text('applied_at'),
  status: text('status').default('applied').notNull(),
  current_stage: text('current_stage').default('resume_screening'),
  stages: text('stages'),  // JSON string: StageInfo[]
  notes: text('notes'),
  url: text('url'),
  created_at: text('created_at').default("(datetime('now'))").notNull(),
  updated_at: text('updated_at').default("(datetime('now'))").notNull(),
});

// ========== 岗位信息表 ==========
export const jobListings = sqliteTable('job_listings', {
  id: text('id').primaryKey(),
  company: text('company').notNull(),
  position: text('position').notNull(),
  city: text('city'),
  description: text('description'),
  requirements: text('requirements'),
  salary: text('salary'),
  job_type: text('job_type'), // campus | internship | fulltime
  source_url: text('source_url'),
  deadline: text('deadline'),
  source: text('source'),
  created_at: text('created_at').default("(datetime('now'))").notNull(),
});

// ========== 收藏岗位表 ==========
export const savedJobs = sqliteTable('saved_jobs', {
  id: text('id').primaryKey(),
  user_id: text('user_id').references(() => users.id).notNull(),
  job_id: text('job_id').references(() => jobListings.id).notNull(),
  created_at: text('created_at').default("(datetime('now'))").notNull(),
}, (table) => ({
  userJobUnique: uniqueIndex('user_job_unique').on(table.user_id, table.job_id),
}));

// ========== 上传文件表 ==========
export const uploadedFiles = sqliteTable('uploaded_files', {
  id: text('id').primaryKey(),
  user_id: text('user_id').references(() => users.id).notNull(),
  filename: text('filename').notNull(),
  file_type: text('file_type').notNull(), // txt | pdf | docx | png | jpg | mp3 | mp4
  file_size: integer('file_size'),
  parsed_text: text('parsed_text'),
  analysis: text('analysis'), // JSON string
  created_at: text('created_at').default("(datetime('now'))").notNull(),
});
