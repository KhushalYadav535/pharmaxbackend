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

// ── Pending Entities ──────────────────────────────────────────────────────────
router.get('/pending-entities', async (req, res) => {
  try {
    const [doctors, hospitals, stockists, retailers, distributors] = await Promise.all([
      prisma.doctor.findMany({ where: { approvalStatus: 'PENDING', isActive: true }, select: { id: true, firstName: true, lastName: true, city: true, createdAt: true } }),
      prisma.hospital.findMany({ where: { approvalStatus: 'PENDING', isActive: true }, select: { id: true, name: true, city: true, createdAt: true } }),
      prisma.stockist.findMany({ where: { approvalStatus: 'PENDING', isActive: true }, select: { id: true, name: true, city: true, createdAt: true } }),
      prisma.retailer.findMany({ where: { approvalStatus: 'PENDING', isActive: true }, select: { id: true, name: true, city: true, createdAt: true } }),
      prisma.distributor.findMany({ where: { approvalStatus: 'PENDING', isActive: true }, select: { id: true, name: true, city: true, createdAt: true } }),
    ]);

    const entities = [
      ...doctors.map(d => ({ id: d.id, type: 'Doctor', name: `Dr. ${d.firstName} ${d.lastName}`, city: d.city, submittedAt: d.createdAt })),
      ...hospitals.map(h => ({ id: h.id, type: 'Hospital', name: h.name, city: h.city, submittedAt: h.createdAt })),
      ...stockists.map(s => ({ id: s.id, type: 'Stockist', name: s.name, city: s.city, submittedAt: s.createdAt })),
      ...retailers.map(r => ({ id: r.id, type: 'Retailer', name: r.name, city: r.city, submittedAt: r.createdAt })),
      ...distributors.map(d => ({ id: d.id, type: 'Distributor', name: d.name, city: d.city, submittedAt: d.createdAt })),
    ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    res.json({ success: true, data: entities });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/entities/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { status } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

    let updated;
    switch (type) {
      case 'Doctor': updated = await prisma.doctor.update({ where: { id }, data: { approvalStatus: status } }); break;
      case 'Hospital': updated = await prisma.hospital.update({ where: { id }, data: { approvalStatus: status } }); break;
      case 'Stockist': updated = await prisma.stockist.update({ where: { id }, data: { approvalStatus: status } }); break;
      case 'Retailer': updated = await prisma.retailer.update({ where: { id }, data: { approvalStatus: status } }); break;
      case 'Distributor': updated = await prisma.distributor.update({ where: { id }, data: { approvalStatus: status } }); break;
      default: return res.status(400).json({ success: false, message: 'Invalid entity type' });
    }
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
