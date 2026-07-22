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

// ── 智谱 GLM 多模态简历解析（PNG/JPG 直传，PDF/Word 提取后 LLM 整理）──
router.post('/parse-resume', (req: Request, res: Response, next: Function) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: true, message: `文件过大，最大 ${config.upload.maxFileSize / 1048576}MB` });
      return res.status(400).json({ error: true, message: err.message || '上传失败' });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: true, message: '请选择要上传的文件' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
  };
  const mimeType = mimeMap[ext];
  if (!mimeType) {
    return res.status(400).json({ error: true, message: `不支持的文件格式: ${ext}，请上传 PNG/JPG/PDF/Word` });
  }

  try {
    const { parseResumeWithZhipu } = require('../services/ai/zhipu');
    const parsedText = await parseResumeWithZhipu(req.file.path, req.file.originalname, mimeType);
    return res.json({ text: parsedText, filename: req.file.originalname });
  } catch (err: any) {
    console.error('Resume parse error:', err.message);
    return res.status(500).json({ error: true, message: `简历解析失败: ${err.message}` });
  }
});

export default router;
