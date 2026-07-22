import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { optionalAuth } from '../middleware/auth';
import { config } from '../config';
import { db, saveDb, uploadedFiles } from '../db';
import { eq, desc } from 'drizzle-orm';
import { parseFile, getFileType } from '../services/file/parser';
import { chatJSON } from '../services/ai/client';
import { parseResumeWithAI, parseJDWithAI } from '../services/ai/zhipu';
import { RESUME_ANALYZER_PROMPT, JD_ANALYZER_PROMPT, SYSTEM_PERSONA } from '../services/ai/prompts';
import type { ResumeAnalysis, JdAnalysis } from '../types';

const router = Router();
router.use(optionalAuth);

if (!fs.existsSync(config.upload.uploadDir)) fs.mkdirSync(config.upload.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.upload.uploadDir),
  filename: (_req, file, cb) => { const id = uuidv4(); const ext = path.extname(file.originalname); cb(null, `${id}${ext}`); },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(txt|pdf|docx|doc|png|jpg|jpeg|mp3|mp4|wav|m4a|webm)$/i;
    allowed.test(path.extname(file.originalname)) ? cb(null, true) : cb(new Error(`不支持的文件格式: ${path.extname(file.originalname)}`));
  },
});

// 允许上传的简历/JD 文件格式
const RESUME_JD_ALLOWED = /\.(pdf|docx|doc|png|jpg|jpeg|txt)$/i;

// ── 通用文件上传（返回解析文本预览，用于复盘等场景）──
router.post('/upload', (req: Request, res: Response, next: Function) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: true, message: `文件过大，最大 ${config.upload.maxFileSize / 1048576}MB` });
      return res.status(400).json({ error: true, message: err.message || '上传失败' });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: true, message: '请选择要上传的文件' });
  const fileType = getFileType(req.file.originalname);
  let parsedText = '';
  try { parsedText = await parseFile(req.file.path, fileType); } catch (err: any) { parsedText = `解析失败: ${err.message}`; }

  const fileRecord = {
    id: uuidv4(), user_id: req.userId!, filename: req.file.originalname, file_type: fileType,
    file_size: req.file.size, parsed_text: parsedText, analysis: null, created_at: new Date().toISOString(),
  };
  try { db().insert(uploadedFiles).values(fileRecord as any).run(); saveDb(); } catch (dbErr: any) { console.error('DB write:', dbErr.message); }
  return res.status(201).json({ ...fileRecord, parsed_text_preview: parsedText.slice(0, 500) });
});

router.get('/', (req: Request, res: Response) => {
  const files = db().select({ id: uploadedFiles.id, filename: uploadedFiles.filename, file_type: uploadedFiles.file_type, file_size: uploadedFiles.file_size, created_at: uploadedFiles.created_at })
    .from(uploadedFiles).where(eq(uploadedFiles.user_id, req.userId!)).orderBy(desc(uploadedFiles.created_at)).all();
  return res.json(files);
});

router.get('/:id', (req: Request, res: Response) => {
  const file = db().select().from(uploadedFiles).where(eq(uploadedFiles.id, req.params.id)).all()[0];
  if (!file) return res.status(404).json({ error: true, message: '文件不存在' });
  return res.json(file);
});

router.post('/:id/analyze', async (req: Request, res: Response) => {
  const { analysis_type } = req.body as { analysis_type: 'resume' | 'jd' };
  if (!analysis_type || !['resume', 'jd'].includes(analysis_type)) return res.status(400).json({ error: true, message: '请指定有效的分析类型: resume 或 jd' });

  const file = db().select().from(uploadedFiles).where(eq(uploadedFiles.id, req.params.id)).all()[0] as any;
  if (!file) return res.status(404).json({ error: true, message: '文件不存在' });
  if (!file.parsed_text || file.parsed_text.trim().length === 0) return res.status(400).json({ error: true, message: '文件未解析到有效文本内容' });

  try {
    let analysis: any;
    if (analysis_type === 'resume') {
      analysis = await chatJSON<ResumeAnalysis>([{ role: 'system', content: SYSTEM_PERSONA }, { role: 'user', content: RESUME_ANALYZER_PROMPT(file.parsed_text) }], { temperature: 0.2 });
    } else {
      analysis = await chatJSON<JdAnalysis>([{ role: 'system', content: SYSTEM_PERSONA }, { role: 'user', content: JD_ANALYZER_PROMPT(file.parsed_text) }], { temperature: 0.2 });
    }
    db().update(uploadedFiles).set({ analysis: JSON.stringify({ type: analysis_type, result: analysis }) }).where(eq(uploadedFiles.id, req.params.id)).run();
    saveDb();
    return res.json({ type: analysis_type, result: analysis });
  } catch (err: any) { return res.status(500).json({ error: true, message: `AI分析失败: ${err.message}` }); }
});

router.delete('/:id', (req: Request, res: Response) => {
  db().delete(uploadedFiles).where(eq(uploadedFiles.id, req.params.id)).run();
  saveDb();
  return res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// 面试准备模块：两步式上传 → 缓存 → 确认 → AI 解析
// ① 上传即本地解析并缓存，原始文本不返回前端
// ② 用户点击"开始面试"后才调用智谱大模型
// ═══════════════════════════════════════════════════════════════

/**
 * POST /prep-resume — 上传简历文件，本地解析后缓存
 * 请求：multipart/form-data, file 字段
 * 返回：{ id, filename, file_type } — 不含解析文本
 */
router.post('/prep-resume', (req: Request, res: Response, next: Function) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: true, message: `文件过大，最大 ${config.upload.maxFileSize / 1048576}MB` });
      return res.status(400).json({ error: true, message: err.message || '上传失败' });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: true, message: '请选择要上传的简历文件' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!RESUME_JD_ALLOWED.test(req.file.originalname)) {
    return res.status(400).json({ error: true, message: `不支持的简历格式: ${ext}，请上传 PDF / Word / PNG / JPG` });
  }

  const fileType = getFileType(req.file.originalname);
  let parsedText = '';
  try {
    parsedText = await parseFile(req.file.path, fileType);
  } catch (err: any) {
    // 清理已上传的文件
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(422).json({ error: true, message: `简历解析失败: ${err.message}` });
  }

  if (!parsedText.trim()) {
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(422).json({ error: true, message: '未能从简历文件中提取到文字内容，请确认文件清晰度' });
  }

  const id = uuidv4();
  try {
    db().insert(uploadedFiles).values({
      id, user_id: req.userId!, filename: req.file.originalname, file_type: fileType,
      file_size: req.file.size, parsed_text: parsedText, created_at: new Date().toISOString(),
    } as any).run();
    saveDb();
  } catch (dbErr: any) {
    console.error('DB write:', dbErr.message);
    return res.status(500).json({ error: true, message: '保存失败，请重试' });
  }

  // 只返回文件元信息，不返回解析文本
  return res.status(201).json({ id, filename: req.file.originalname, file_type: fileType });
});

/**
 * POST /prep-jd — 上传 JD 文件，本地解析后缓存
 * 请求：multipart/form-data, file 字段
 * 返回：{ id, filename, file_type } — 不含解析文本
 */
router.post('/prep-jd', (req: Request, res: Response, next: Function) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: true, message: `文件过大，最大 ${config.upload.maxFileSize / 1048576}MB` });
      return res.status(400).json({ error: true, message: err.message || '上传失败' });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: true, message: '请选择要上传的 JD 文件' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!RESUME_JD_ALLOWED.test(req.file.originalname)) {
    return res.status(400).json({ error: true, message: `不支持的 JD 格式: ${ext}，请上传 PDF / Word / PNG / JPG` });
  }

  const fileType = getFileType(req.file.originalname);
  let parsedText = '';
  try {
    parsedText = await parseFile(req.file.path, fileType);
  } catch (err: any) {
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(422).json({ error: true, message: `JD 解析失败: ${err.message}` });
  }

  if (!parsedText.trim()) {
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(422).json({ error: true, message: '未能从 JD 文件中提取到文字内容' });
  }

  const id = uuidv4();
  try {
    db().insert(uploadedFiles).values({
      id, user_id: req.userId!, filename: req.file.originalname, file_type: fileType,
      file_size: req.file.size, parsed_text: parsedText, created_at: new Date().toISOString(),
    } as any).run();
    saveDb();
  } catch (dbErr: any) {
    console.error('DB write:', dbErr.message);
    return res.status(500).json({ error: true, message: '保存失败，请重试' });
  }

  return res.status(201).json({ id, filename: req.file.originalname, file_type: fileType });
});

/**
 * POST /cache-text — 缓存纯文本（用于 JD 手动粘贴场景）
 * 请求：JSON { text: string, type: 'jd' | 'resume' }
 * 返回：{ id }
 */
router.post('/cache-text', (req: Request, res: Response) => {
  const { text, type } = req.body as { text?: string; type?: string };
  if (!text || !text.trim()) {
    return res.status(400).json({ error: true, message: '请提供文本内容' });
  }
  if (!['jd', 'resume'].includes(type || '')) {
    return res.status(400).json({ error: true, message: 'type 必须为 jd 或 resume' });
  }

  const id = uuidv4();
  try {
    db().insert(uploadedFiles).values({
      id, user_id: req.userId!, filename: `pasted_${type}.txt`, file_type: 'txt',
      file_size: Buffer.byteLength(text), parsed_text: text.trim(), created_at: new Date().toISOString(),
    } as any).run();
    saveDb();
  } catch (dbErr: any) {
    console.error('DB write:', dbErr.message);
    return res.status(500).json({ error: true, message: '保存失败，请重试' });
  }

  return res.status(201).json({ id });
});

/**
 * POST /:id/confirm — 确认后调用智谱 AI 解析缓存文本
 * 请求：JSON { type: 'resume' | 'jd' }
 * 返回：{ text: string } — AI 解析后的结构化文本
 */
router.post('/:id/confirm', async (req: Request, res: Response) => {
  const { type } = req.body as { type?: string };
  if (!type || !['resume', 'jd'].includes(type)) {
    return res.status(400).json({ error: true, message: 'type 必须为 resume 或 jd' });
  }

  const file = db().select().from(uploadedFiles).where(eq(uploadedFiles.id, req.params.id)).all()[0] as any;
  if (!file) return res.status(404).json({ error: true, message: '缓存记录不存在，请重新上传' });
  if (!file.parsed_text || file.parsed_text.trim().length === 0) {
    return res.status(400).json({ error: true, message: '缓存文本为空，请重新上传文件' });
  }

  try {
    let result: string;
    if (type === 'resume') {
      result = await parseResumeWithAI(file.parsed_text);
    } else {
      result = await parseJDWithAI(file.parsed_text);
    }

    // 更新 analysis 字段记录 AI 解析结果
    db().update(uploadedFiles).set({ analysis: JSON.stringify({ type, result, parsedAt: new Date().toISOString() }) }).where(eq(uploadedFiles.id, req.params.id)).run();
    saveDb();

    return res.json({ text: result });
  } catch (err: any) {
    console.error('Zhipu confirm error:', err.message);
    return res.status(500).json({ error: true, message: `AI 解析失败: ${err.message}` });
  }
});

export default router;
