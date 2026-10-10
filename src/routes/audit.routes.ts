import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// ─── GET /api/v1/audit-logs ───────────────────────────────────────────────────
// List audit logs with multi-parameter filtering and pagination
router.get('/', requireManager, async (req, res) => {
  try {
    const {
      page = '1',
      limit = '25',
      action,
      entity,
      userId,
      search,
      startDate,
      endDate,
    } = req.query;

    const p = Math.max(1, parseInt(page as string, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));

    const where: any = {};

    if (action && action !== 'ALL') {
      where.action = action as string;
    }

    if (entity && entity !== 'ALL') {
      where.entity = entity as string;
    }

    if (userId) {
      where.userId = userId as string;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { action: { contains: q, mode: 'insensitive' } },
        { entity: { contains: q, mode: 'insensitive' } },
        { entityId: { contains: q, mode: 'insensitive' } },
        { ipAddress: { contains: q, mode: 'insensitive' } },
        { user: { firstName: { contains: q, mode: 'insensitive' } } },
        { user: { lastName: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: (p - 1) * l,
        take: l,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              employeeId: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/v1/audit-logs/stats ─────────────────────────────────────────────
// Summary statistics for governance and security dashboard
router.get('/stats', requireManager, async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, todayCount, byAction, byEntity] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { createdAt: { gte: today } } }),
      prisma.auditLog.groupBy({
        by: ['action'],
        _count: true,
        orderBy: { _count: { action: 'desc' } },
        take: 6,
      }),
      prisma.auditLog.groupBy({
        by: ['entity'],
        _count: true,
        orderBy: { _count: { entity: 'desc' } },
        take: 6,
      }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        todayCount,
        byAction: byAction.map((a) => ({ action: a.action, count: a._count })),
        byEntity: byEntity.map((e) => ({ entity: e.entity, count: e._count })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
