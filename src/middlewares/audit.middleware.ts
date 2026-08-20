import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';

export const auditLog = (action: string, entity: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        prisma.auditLog
          .create({
            data: {
              userId: req.user.userId,
              action,
              entity,
              entityId: req.params.id || body?.data?.id,
              newValues: req.body,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
            },
          })
          .catch(console.error);
      }
      return originalJson(body);
    };
    next();
  };
};
