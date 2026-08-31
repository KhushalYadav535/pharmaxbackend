import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// Helper function to get the user ID filter for managers vs admins
async function getManagerFilter(req: any) {
  const currentUser = req.user!;
  const isAdmin = ['SUPER_ADMIN', 'SALES_ADMIN', 'NSM', 'ZM'].includes(currentUser.role);
  
  if (isAdmin) {
    return {}; // No filter, admins see everything
  }

  const teamIds = await prisma.user.findMany({
    where: { managerId: currentUser.userId, isActive: true },
    select: { id: true },
  });
  const userIds = teamIds.map((u) => u.id);

  if (userIds.length === 0) {
    return { userId: { in: ['___NO_TEAM___'] } }; // Hack to return empty results safely
  }

  return { userId: { in: userIds } };
}

// ── Pending Visits ────────────────────────────────────────────────────────────
router.get('/pending-visits', requireManager, async (req, res) => {
  try {
    const userFilter = await getManagerFilter(req);
    
    const pending = await prisma.visit.findMany({
      where: { ...userFilter, status: 'COMPLETED', approvalStatus: 'PENDING' },
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
    const userFilter = await getManagerFilter(req);

    const pending = await prisma.expense.findMany({
      where: { ...userFilter, approvalStatus: 'PENDING' },
      orderBy: { expenseDate: 'desc' },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json({ success: true, data: pending });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Pending Tour Plans ────────────────────────────────────────────────────────
router.get('/pending-tourplans', requireManager, async (req, res) => {
  try {
    const userFilter = await getManagerFilter(req);

    const pending = await prisma.tourPlan.findMany({
      where: { 
        ...userFilter, 
        approvalStatus: 'PENDING',
        planDate: { not: null }  // Only explicitly submitted plans
      },
      orderBy: { planDate: 'asc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, employeeId: true, role: true } },
        hq: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        _count: { select: { days: true } }
      },
    });

    // Add visit count to each plan
    const plansWithStats = await Promise.all(pending.map(async (plan) => {
      const visitCount = await prisma.visit.count({
        where: { tourPlanDay: { tourPlanId: plan.id } }
      });
      return { ...plan, visitCount };
    }));

    res.json({ success: true, data: plansWithStats });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Approve / Reject Tour Plan ──────────────────────────────────────────
router.patch('/tourplans/:id/approve', requireManager, async (req, res) => {
  try {
    const updated = await prisma.tourPlan.update({
      where: { id: req.params.id as string },
      data: { approvalStatus: 'APPROVED' }
    });
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

router.patch('/tourplans/:id/reject', requireManager, async (req, res) => {
  try {
    const updated = await prisma.tourPlan.update({
      where: { id: req.params.id as string },
      data: { approvalStatus: 'REJECTED' }
    });
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// ── Pending Leaves ────────────────────────────────────────────────────────────
router.get('/pending-leaves', requireManager, async (req, res) => {
  try {
    const userFilter = await getManagerFilter(req);

    const pending = await prisma.leave.findMany({
      where: { ...userFilter, approvalStatus: 'PENDING' },
      orderBy: { startDate: 'asc' },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json({ success: true, data: pending });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Aggregated summary count ──────────────────────────────────────────────────
router.get('/summary', requireManager, async (req, res) => {
  try {
    const userFilter = await getManagerFilter(req);

    const [pendingVisits, pendingExpenses, pendingLeaves, pendingTourPlans] = await Promise.all([
      prisma.visit.count({ where: { ...userFilter, status: 'COMPLETED', approvalStatus: 'PENDING' } }),
      prisma.expense.count({ where: { ...userFilter, approvalStatus: 'PENDING' } }),
      prisma.leave.count({ where: { ...userFilter, approvalStatus: 'PENDING' } }),
      prisma.tourPlan.count({ where: { ...userFilter, approvalStatus: 'PENDING', planDate: { not: null } } }),
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
    const { type } = req.params;
    const id = req.params.id as string;
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
