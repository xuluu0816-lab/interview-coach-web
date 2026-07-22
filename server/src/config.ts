import dotenv from 'dotenv';
import path from 'path';

// 加载 .env 文件（优先项目根目录）
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // 数据库
  db: {
    path: process.env.DB_PATH || path.resolve(__dirname, '../../data/interview-coach.db'),
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'interview-coach-dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // DeepSeek API
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || 'sk-96fcf56093e54cd8b00af457c386af8c',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    maxTokens: parseInt(process.env.DEEPSEEK_MAX_TOKENS || '4096', 10),
    temperature: parseFloat(process.env.DEEPSEEK_TEMPERATURE || '0.7'),
  },

  // 智谱 AI (GLM) — 多模态+文本简历解析
  // 免费获取 API Key: https://open.bigmodel.cn/usercenter/apikeys
  zhipu: {
    apiKey: process.env.ZHIPU_API_KEY || '',
    visionModel: process.env.ZHIPU_VISION_MODEL || 'glm-4v-flash',
    textModel: process.env.ZHIPU_TEXT_MODEL || 'glm-4-flash',
  },

  // 文件上传
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB
    uploadDir: path.resolve(__dirname, '../uploads'),
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
};
