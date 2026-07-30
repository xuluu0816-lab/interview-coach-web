/**
 * 文件解析服务 — 根据文件类型路由到对应的解析器
 * 所有解析（包括图片 OCR）均在后端本地完成，不依赖外部 API
 */
import fs from 'fs';
import path from 'path';
import { FileType } from '../../types';

// ── tesseract.js 单例 worker（避免重复加载语言包）──
let _worker: any = null;
let _workerLoading: Promise<any> | null = null;
let _ocrStatus: 'unloaded' | 'loading' | 'ready' | 'error' = 'unloaded';
let _ocrError: string = '';

export function getOcrStatus(): { status: string; error?: string } {
  return { status: _ocrStatus, error: _ocrError || undefined };
}

async function getOcrWorker(): Promise<any> {
  if (_worker) return _worker;
  if (_workerLoading) return _workerLoading;

  _ocrStatus = 'loading';
  _workerLoading = (async () => {
    try {
      const { createWorker } = require('tesseract.js');
      // 只加载中文语言包（面试场景以中文简历/JD为主，节省 ~15MB 内存）
      _worker = await createWorker('chi_sim', 1, {
        logger: (m: any) => {
          if (m.status === 'error') {
            console.error('Tesseract OCR error:', m);
            _ocrError = String(m);
          } else if (m.status === 'loading language traineddata') {
            console.log(`Tesseract: ${m.status} (${Math.round(m.progress * 100)}%)`);
          }
        },
      });
      _ocrStatus = 'ready';
      _ocrError = '';
      return _worker;
    } catch (err: any) {
      _ocrStatus = 'error';
      _ocrError = err.message || String(err);
      _workerLoading = null; // 允许重试
      throw err;
    }
  })();

  return _workerLoading;
}

/** 服务启动时预热 OCR 引擎（同步等待，确保首次图片上传时 OCR 已就绪） */
export async function warmUpOcr(): Promise<void> {
  console.log('Warming up tesseract.js OCR engine (chi_sim only)...');
  const startTime = Date.now();
  try {
    await getOcrWorker();
    console.log(`Tesseract.js OCR engine ready (took ${Date.now() - startTime}ms).`);
  } catch (err: any) {
    console.error(`OCR warm-up FAILED after ${Date.now() - startTime}ms: ${err.message}`);
    console.error('Image uploads will not work until OCR is fixed. PDF/DOCX/TXT uploads are unaffected.');
    // 不阻止服务启动，允许非图片文件继续工作
  }
}

/**
 * 使用 tesseract.js 本地 OCR 识别图片文字
 * 支持中文识别（面试场景以中文简历/JD为主）
 */
async function ocrImage(filePath: string): Promise<string> {
  // 检查模块是否存在
  try {
    require.resolve('tesseract.js');
  } catch {
    throw new Error('OCR 引擎未安装，图片格式暂不支持。请使用 PDF / Word / TXT 格式上传，或将图片中的文字手动粘贴。');
  }

  try {
    const worker = await getOcrWorker();
    const { data: { text } } = await worker.recognize(filePath);
    const trimmed = text?.trim() || '';
    if (!trimmed) {
      throw new Error('OCR 未能识别到文字。请确认：①图片清晰度 ②文字方向 ③建议使用 PDF/TXT 格式上传。');
    }
    return trimmed;
  } catch (err: any) {
    if (err.message?.includes('Failed to fetch') || err.message?.includes('Network')) {
      throw new Error('OCR 引擎加载超时（Render 免费服务器内存限制），请使用 PDF / Word / TXT 格式上传。');
    }
    throw new Error(`图片 OCR 识别失败: ${err.message}`);
  }
}

/**
 * 解析文本文件（txt）
 */
async function parseTxt(filePath: string): Promise<string> {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * 解析 PDF 文件
 * 使用 pdf-parse 库
 */
async function parsePdf(filePath: string): Promise<string> {
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text || '';
  } catch (err: any) {
    if (err.message?.includes('Cannot find module')) {
      throw new Error('pdf-parse 未安装，请运行: npm install pdf-parse');
    }
    throw err;
  }
}

/**
 * 解析 Word 文件（docx）
 * 使用 mammoth 库
 */
async function parseDocx(filePath: string): Promise<string> {
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  } catch (err: any) {
    if (err.message?.includes('Cannot find module')) {
      throw new Error('mammoth 未安装，请运行: npm install mammoth');
    }
    throw err;
  }
}

/**
 * 根据文件扩展名确定文件类型
 */
export function getFileType(filename: string): FileType {
  const ext = path.extname(filename).toLowerCase();
  const typeMap: Record<string, FileType> = {
    '.txt': 'txt',
    '.pdf': 'pdf',
    '.docx': 'docx',
    '.doc': 'docx',
    '.png': 'png',
    '.jpg': 'jpg',
    '.jpeg': 'jpg',
    '.mp3': 'mp3',
    '.mp4': 'mp4',
  };
  return typeMap[ext] || 'txt';
}

/**
 * 文件解析主入口 — 根据类型调用对应解析器
 */
export async function parseFile(filePath: string, fileType: FileType): Promise<string> {
  switch (fileType) {
    case 'txt':
      return parseTxt(filePath);
    case 'pdf':
      return parsePdf(filePath);
    case 'docx':
      return parseDocx(filePath);
    case 'png':
    case 'jpg':
      return ocrImage(filePath);
    case 'mp3':
    case 'mp4':
      // 音视频转写将在第二阶段实现（OpenAI Whisper API）
      return '[音视频文件] 语音转文字功能将在第二阶段上线。当前阶段请手动输入音视频中的文字内容。';
    default:
      throw new Error(`不支持的文件类型: ${fileType}`);
  }
}

/**
 * 判断该文件类型是否需要 OCR 或其他特殊处理
 */
export function needsSpecialProcessing(fileType: FileType): boolean {
  return ['png', 'jpg', 'mp3', 'mp4'].includes(fileType);
}
