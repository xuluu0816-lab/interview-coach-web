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

async function getOcrWorker(): Promise<any> {
  if (_worker) return _worker;
  if (_workerLoading) return _workerLoading;

  _workerLoading = (async () => {
    const { createWorker } = require('tesseract.js');
    _worker = await createWorker('chi_sim+eng', 1, {
      logger: (m: any) => {
        if (m.status === 'error') console.error('Tesseract OCR error:', m);
        else if (m.status === 'loading language traineddata') console.log(`Tesseract: ${m.status} (${Math.round(m.progress * 100)}%)`);
        else console.log(`Tesseract: ${m.status}`);
      },
    });
    return _worker;
  })();

  return _workerLoading;
}

/** 服务启动时预热 OCR 引擎（下载语言包，避免首次请求超时） */
export async function warmUpOcr(): Promise<void> {
  console.log('Warming up tesseract.js OCR engine...');
  try {
    await getOcrWorker();
    console.log('Tesseract.js OCR engine ready.');
  } catch (err: any) {
    console.warn('OCR warm-up failed (non-fatal, will retry on first image upload):', err.message);
  }
}

/**
 * 使用 tesseract.js 本地 OCR 识别图片文字
 * 支持中文 + 英文混合识别
 */
async function ocrImage(filePath: string): Promise<string> {
  try {
    const worker = await getOcrWorker();
    const { data: { text } } = await worker.recognize(filePath);
    const trimmed = text?.trim() || '';
    if (!trimmed) throw new Error('OCR 未能识别到文字，请确认图片清晰度');
    return trimmed;
  } catch (err: any) {
    if (err.message?.includes('Cannot find module')) {
      throw new Error('tesseract.js 未安装，请运行: npm install tesseract.js');
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
