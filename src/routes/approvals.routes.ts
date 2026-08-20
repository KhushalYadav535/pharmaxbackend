import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// ── Pending Visits ────────────────────────────────────────────────────────────
router.get('/pending-visits', requireManager, async (req, res) => {
  try {
    const teamIds = await prisma.user.findMany({
      where: { managerId: req.user!.userId, isActive: true },
      select: { id: true },
    });
    const userIds = teamIds.map((u) => u.id);

    const pending = await prisma.visit.findMany({
      where: { userId: { in: userIds }, status: 'COMPLETED', approvalStatus: 'PENDING' },
      orderBy: { checkInTime: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
        doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
        retailer: { select: { id: true, name: true } },
        distributor: { select: { id: true, name: true } },
      },
    });
    res.json({ success: true, data: pending });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Pending Expenses ──────────────────────────────────────────────────────────
router.get('/pending-expenses', requireManager, async (req, res) => {
  try {
    const teamIds = await prisma.user.findMany({
      where: { managerId: req.user!.userId, isActive: true },
      select: { id: true },
    });
    const userIds = teamIds.map((u) => u.id);

    const pending = await prisma.expense.findMany({
      where: { userId: { in: userIds }, approvalStatus: 'PENDING' },
      orderBy: { expenseDate: 'desc' },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json({ success: true, data: pending });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Pending Tour Plans ────────────────────────────────────────────────────────
router.get('/pending-tourplans', requireManager, async (req, res) => {
  try {
    const teamIds = await prisma.user.findMany({
      where: { managerId: req.user!.userId, isActive: true },
      select: { id: true },
    });
    const userIds = teamIds.map((u) => u.id);

    const pending = await prisma.tourPlan.findMany({
      where: { userId: { in: userIds }, approvalStatus: 'PENDING' },
      orderBy: { planDate: 'asc' },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json({ success: true, data: pending });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Pending Leaves ────────────────────────────────────────────────────────────
router.get('/pending-leaves', requireManager, async (req, res) => {
  try {
    const teamIds = await prisma.user.findMany({
      where: { managerId: req.user!.userId, isActive: true },
      select: { id: true },
    });
    const userIds = teamIds.map((u) => u.id);

    const pending = await prisma.leave.findMany({
      where: { userId: { in: userIds }, approvalStatus: 'PENDING' },
      orderBy: { startDate: 'asc' },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json({ success: true, data: pending });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Aggregated summary count ──────────────────────────────────────────────────
router.get('/summary', requireManager, async (req, res) => {
  try {
    const teamIds = await prisma.user.findMany({
      where: { managerId: req.user!.userId, isActive: true },
      select: { id: true },
    });
    const userIds = teamIds.map((u) => u.id);

    const [pendingVisits, pendingExpenses, pendingLeaves, pendingTourPlans] = await Promise.all([
      prisma.visit.count({ where: { userId: { in: userIds }, status: 'COMPLETED', approvalStatus: 'PENDING' } }),
      prisma.expense.count({ where: { userId: { in: userIds }, approvalStatus: 'PENDING' } }),
      prisma.leave.count({ where: { userId: { in: userIds }, approvalStatus: 'PENDING' } }),
      prisma.tourPlan.count({ where: { userId: { in: userIds }, approvalStatus: 'PENDING' } }),
    ]);

    res.json({ success: true, data: { pendingVisits, pendingExpenses, pendingLeaves, pendingTourPlans, total: pendingVisits + pendingExpenses + pendingLeaves + pendingTourPlans } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
