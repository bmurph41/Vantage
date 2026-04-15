import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createRequestLogger } from '../lib/logger';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      log: ReturnType<typeof createRequestLogger>;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  const userId = (req as any).user?.id;
  const tenantId = (req as any).user?.orgId;
  
  req.log = createRequestLogger(requestId, userId, tenantId);
  
  next();
}

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  if (!req.path.startsWith('/api/')) {
    return next();
  }
  
  const userId = (req as any).user?.id;
  const tenantId = (req as any).user?.orgId;
  
  req.log.info({
    type: 'request_start',
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    userId,
    tenantId,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.socket.remoteAddress,
  });
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    {
      const logData = {
        type: 'request_complete',
        method: req.method,
        url: req.originalUrl,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        userId: (req as any).user?.id,
        tenantId: (req as any).user?.orgId,
      };
      
      if (res.statusCode >= 500) {
        req.log.error(logData);
      } else if (res.statusCode >= 400) {
        req.log.warn(logData);
      } else {
        req.log.info(logData);
      }
    }
  });
  
  next();
}
