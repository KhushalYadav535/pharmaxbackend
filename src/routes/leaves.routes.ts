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

import { hrmsLeaveService } from '../services/hrmsLeaveService';

// Apply for leave
router.post('/', async (req, res) => {
  try {
    const { startDate, endDate, leaveType, reason, isHalfDay, halfDaySession } = req.body;
    
    // Find matching leave type by code or name
    const allTypes = await prisma.leaveType.findMany({ where: { status: true } });
    const normalized = (leaveType || '').toUpperCase();
    const matched = allTypes.find((t) => 
      t.code === normalized || 
      t.name.toUpperCase().includes(normalized) ||
      (normalized === 'CASUAL' && t.code === 'CL') ||
      (normalized === 'SICK' && t.code === 'SL') ||
      (normalized === 'EARNED' && t.code === 'EL')
    ) || allTypes[0];

    const leave = await hrmsLeaveService.applyLeave(req.user!.userId, {
      leaveTypeId: matched.id,
      startDate,
      endDate,
      isHalfDay: !!isHalfDay,
      halfDaySession,
      reason,
    });

    res.status(201).json({ success: true, data: leave });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Approve leave (manager)
router.patch('/:id/approve', requireManager, async (req, res) => {
  try {
    const leave = await hrmsLeaveService.reviewLeave(
      req.params.id as string,
      req.user!.userId,
      req.user!.role,
      'APPROVE',
      req.body.remarks
    );
    res.json({ success: true, data: leave });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Reject leave (manager)
router.patch('/:id/reject', requireManager, async (req, res) => {
  try {
    const leave = await hrmsLeaveService.reviewLeave(
      req.params.id as string,
      req.user!.userId,
      req.user!.role,
      'REJECT',
      req.body.remarks || req.body.rejectionReason
    );
    res.json({ success: true, data: leave });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Cancel own leave
router.patch('/:id/cancel', async (req, res) => {
  try {
    const updated = await hrmsLeaveService.cancelLeave(req.params.id as string, req.user!.userId);
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Leave balance summary (backward compatible + enriched with HRMS leave balances)
router.get('/balance', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const balances = await hrmsLeaveService.getEmployeeLeaveBalances(userId);

    const cl = balances.find((b) => b.leaveType.code === 'CL');
    const sl = balances.find((b) => b.leaveType.code === 'SL');
    const el = balances.find((b) => b.leaveType.code === 'EL');

    res.json({
      success: true,
      data: {
        casual: {
          taken: cl?.used || 0,
          total: cl?.openingBalance || 12,
          remaining: cl ? Math.max(0, cl.closingBalance - cl.pending) : 12,
        },
        sick: {
          taken: sl?.used || 0,
          total: sl?.openingBalance || 10,
          remaining: sl ? Math.max(0, sl.closingBalance - sl.pending) : 10,
        },
        earned: {
          taken: el?.used || 0,
          total: el?.openingBalance || 15,
          remaining: el ? Math.max(0, el.closingBalance - el.pending) : 15,
        },
        balances,
      },
    });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
