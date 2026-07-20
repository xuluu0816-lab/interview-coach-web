/**
 * 文件解析服务 — 根据文件类型路由到对应的解析器
 */
import fs from 'fs';
import path from 'path';
import { FileType } from '../../types';

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
      // 图片 OCR 在第二阶段实现（前端 tesseract.js）
      return '[图片文件] 图片 OCR 功能将在第二阶段上线。当前阶段请手动输入图片中的文字内容。';
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
