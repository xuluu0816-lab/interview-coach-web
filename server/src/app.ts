import express from 'express';
import cors from 'cors';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import sessionRoutes from './routes/sessions';
import interviewRoutes from './routes/interview';
import reviewRoutes from './routes/review';
import questionRoutes from './routes/questions';
import progressRoutes from './routes/progress';
import fileRoutes from './routes/files';
import applicationRoutes from './routes/applications';
import jobRoutes from './routes/jobs';
import analyzeRoutes from './routes/analyze';

const app = express();

// 基础中间件
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（上传文件访问）
app.use('/uploads', express.static(config.upload.uploadDir));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/sessions', interviewRoutes);       // POST /api/sessions/:id/chat
app.use('/api/sessions', reviewRoutes);           // POST /api/sessions/:id/review, /complete
app.use('/api/questions', questionRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/analyze', analyzeRoutes);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 全局错误处理
app.use(errorHandler);

export default app;
