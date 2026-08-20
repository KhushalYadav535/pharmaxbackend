import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// List all leaves — own for MR, team for manager
router.get('/', async (req, res) => {
  try {
    const { status, userId } = req.query;
    const where: any = {};
    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) {
      where.userId = req.user!.userId;
    } else if (userId) {
      where.userId = userId;
    }
    if (status) where.approvalStatus = status;

    const leaves = await prisma.leave.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });
    res.json({ success: true, data: leaves });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Apply for leave
router.post('/', async (req, res) => {
  try {
    const { startDate, endDate, leaveType, reason } = req.body;
    const leave = await prisma.leave.create({
      data: {
        userId: req.user!.userId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        leaveType,
        reason,
        approvalStatus: 'PENDING',
      },
    });
    res.status(201).json({ success: true, data: leave });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Approve leave (manager)
router.patch('/:id/approve', requireManager, async (req, res) => {
  try {
    const leave = await prisma.leave.update({
      where: { id: req.params.id as string },
      data: { approvalStatus: 'APPROVED', approvedAt: new Date() },
    });
    res.json({ success: true, data: leave });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Reject leave (manager)
router.patch('/:id/reject', requireManager, async (req, res) => {
  try {
    const leave = await prisma.leave.update({
      where: { id: req.params.id as string },
      data: { approvalStatus: 'REJECTED' },
    });
    res.json({ success: true, data: leave });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Cancel own leave
router.patch('/:id/cancel', async (req, res) => {
  try {
    const leave = await prisma.leave.findUnique({ where: { id: req.params.id as string } });
    if (!leave || leave.userId !== req.user!.userId) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (leave.approvalStatus === 'APPROVED') return res.status(400).json({ success: false, message: 'Cannot cancel approved leave' });
    const updated = await prisma.leave.update({
      where: { id: req.params.id as string },
      data: { approvalStatus: 'CANCELLED' },
    });
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Leave balance summary
router.get('/balance', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    const leaves = await prisma.leave.findMany({
      where: { userId, startDate: { gte: startOfYear, lte: endOfYear }, approvalStatus: 'APPROVED' },
    });

    const calcDays = (l: any) => {
      const ms = new Date(l.endDate).getTime() - new Date(l.startDate).getTime();
      return Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1;
    };

    const casual = leaves.filter((l) => l.leaveType === 'casual').reduce((s, l) => s + calcDays(l), 0);
    const sick = leaves.filter((l) => l.leaveType === 'sick').reduce((s, l) => s + calcDays(l), 0);
    const earned = leaves.filter((l) => l.leaveType === 'earned').reduce((s, l) => s + calcDays(l), 0);

    res.json({
      success: true,
      data: {
        casual: { taken: casual, total: 12, remaining: Math.max(12 - casual, 0) },
        sick: { taken: sick, total: 12, remaining: Math.max(12 - sick, 0) },
        earned: { taken: earned, total: 21, remaining: Math.max(21 - earned, 0) },
      },
    });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
