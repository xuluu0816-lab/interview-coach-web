import initSqlJs from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import * as schema from './schema';
import { config } from '../config';
import path from 'path';
import fs from 'fs';

// 确保数据库目录存在
const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 建表 SQL
const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  company TEXT,
  role TEXT,
  level TEXT,
  jd_text TEXT,
  resume_text TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS interview_questions (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT,
  user_answer TEXT,
  answer_summary TEXT,
  score_structure INTEGER,
  score_content INTEGER,
  score_clarity INTEGER,
  score_highlight INTEGER,
  total_score INTEGER,
  feedback TEXT,
  sequence INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS question_bank (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  question_text TEXT NOT NULL,
  tips TEXT
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  company TEXT NOT NULL,
  position TEXT NOT NULL,
  city TEXT,
  applied_at TEXT,
  status TEXT DEFAULT 'applied',
  current_stage TEXT DEFAULT 'resume_screening',
  stages TEXT,
  notes TEXT,
  url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS job_listings (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  position TEXT NOT NULL,
  city TEXT,
  description TEXT,
  requirements TEXT,
  salary TEXT,
  job_type TEXT,
  source_url TEXT,
  deadline TEXT,
  source TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saved_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  job_id TEXT REFERENCES job_listings(id),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, job_id)
);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  parsed_text TEXT,
  analysis TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`;

// 懒加载数据库实例
let _drizzle: ReturnType<typeof drizzle> | null = null;
let _sqlDb: import('sql.js').Database | null = null;
let _initialized = false;
let _initializing: Promise<ReturnType<typeof drizzle>> | null = null;

/** 自动保存到磁盘 */
function saveToDisk() {
  if (!_sqlDb) return;
  const data = _sqlDb.export();
  fs.writeFileSync(config.db.path, Buffer.from(data));
}

/** 初始化数据库（应用启动时调用一次） */
export async function initDb(): Promise<ReturnType<typeof drizzle>> {
  if (_initialized) return _drizzle!;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const SQL = await initSqlJs();

    let sqlDb: import('sql.js').Database;
    if (fs.existsSync(config.db.path)) {
      const buffer = fs.readFileSync(config.db.path);
      sqlDb = new SQL.Database(buffer);
    } else {
      sqlDb = new SQL.Database();
    }

    // 创建表
    sqlDb.run('PRAGMA foreign_keys = ON');
    sqlDb.run(CREATE_TABLES_SQL);

    // 兼容旧表结构（v1 → v2 迁移）
    try { sqlDb.run('ALTER TABLE sessions ADD COLUMN jd_text TEXT'); } catch {}
    try { sqlDb.run('ALTER TABLE sessions ADD COLUMN resume_text TEXT'); } catch {}

    _sqlDb = sqlDb;
    _drizzle = drizzle(sqlDb, { schema });
    _initialized = true;

    // 定期保存
    setInterval(saveToDisk, 30000);
    // 优雅退出
    const graceful = () => { saveToDisk(); process.exit(); };
    process.on('SIGINT', graceful);
    process.on('SIGTERM', graceful);

    // 立即保存（建表后持久化）
    saveToDisk();

    return _drizzle;
  })();

  return _initializing;
}

/** 同步获取数据库实例（必须先 initDb） */
export function db(): ReturnType<typeof drizzle> {
  if (!_drizzle) throw new Error('Database not initialized. Call initDb() first at app startup.');
  return _drizzle;
}

/** 手动保存（在写入操作后调用确保数据持久化） */
export function saveDb(): void {
  saveToDisk();
}

// 导出 schema
export * from './schema';
