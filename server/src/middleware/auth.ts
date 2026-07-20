import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from './errorHandler';
import { v4 as uuidv4 } from 'uuid';

// 扩展 Request 类型
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * JWT 验证中间件 — 验证请求中的 Bearer token
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('未登录或 Token 已过期', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    throw new AppError('Token 无效或已过期', 401);
  }
}

/**
 * 可选 JWT 验证 — 用于同时支持登录用户和游客的接口
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // 游客模式：分配一个临时 userId
    req.userId = 'guest_' + uuidv4().slice(0, 8);
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
    req.userId = decoded.userId;
  } catch {
    // Token 无效也分配游客 ID
    req.userId = 'guest_' + uuidv4().slice(0, 8);
  }

  next();
}
