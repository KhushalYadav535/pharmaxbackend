import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// ─── GET /api/v1/notifications ────────────────────────────────────────────────
// List notifications for current user with unread counter
router.get('/', async (req, res) => {
  try {
    const { page = '1', limit = '30', type } = req.query;
    const p = Math.max(1, parseInt(page as string, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 30));

    const where: any = { toUserId: req.user!.userId };
    if (type && type !== 'ALL') {
      where.type = type as string;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: (p - 1) * l,
        take: l,
        orderBy: { createdAt: 'desc' },
        include: {
          fromUser: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
        },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { toUserId: req.user!.userId, isRead: false } }),
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        total,
        unreadCount,
        page: p,
        totalPages: Math.ceil(total / l),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/v1/notifications/broadcast ─────────────────────────────────────
// Admin broadcasts an announcement/circular to field force
router.post('/broadcast', requireManager, async (req, res) => {
  try {
    const { title, body, type = 'ANNOUNCEMENT', targetRole = 'ALL', priority = 'NORMAL' } = req.body;

    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and message body are required' });
    }

    // Determine recipient user IDs
    const userWhere: any = { isActive: true, deletedAt: null };
    if (targetRole && targetRole !== 'ALL') {
      userWhere.role = targetRole;
    }

    const recipients = await prisma.user.findMany({
      where: userWhere,
      select: { id: true },
    });

    if (recipients.length === 0) {
      return res.status(404).json({ success: false, message: 'No active recipients found for selected audience' });
    }

    // Bulk create notifications for all target users
    const payload = recipients.map((r) => ({
      toUserId: r.id,
      fromUserId: req.user!.userId,
      title: title.trim(),
      body: body.trim(),
      type: (type as string).toUpperCase(),
      data: { priority, targetRole, broadcastedAt: new Date().toISOString() },
      isRead: false,
    }));

    await prisma.notification.createMany({
      data: payload,
    });

    res.status(201).json({
      success: true,
      data: {
        deliveredCount: recipients.length,
        title,
        targetRole,
      },
      message: `Circular successfully broadcasted to ${recipients.length} team members`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/v1/notifications/:id/read ─────────────────────────────────────
router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await prisma.notification.updateMany({
      where: { id: req.params.id as string, toUserId: req.user!.userId },
      data: { isRead: true, readAt: new Date() },
    });
    res.json({ success: true, data: notification });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/v1/notifications/read-all ─────────────────────────────────────
router.patch('/read-all', async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { toUserId: req.user!.userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
