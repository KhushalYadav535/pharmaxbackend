import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// Doctor coverage analytics
router.get('/doctor-coverage', async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const where: any = {
      visitType: 'DOCTOR',
      ...(fromDate || toDate ? {
        plannedDate: {
          gte: fromDate ? new Date(fromDate as string) : undefined,
          lte: toDate ? new Date(toDate as string) : undefined,
        },
      } : {}),
    };
    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) {
      where.userId = req.user!.userId;
    }

    const [totalVisits, completedVisits, uniqueDoctors] = await Promise.all([
      prisma.visit.count({ where }),
      prisma.visit.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.visit.groupBy({ by: ['doctorId'], where: { ...where, status: 'COMPLETED' } }),
    ]);

    res.json({ success: true, data: { totalVisits, completedVisits, uniqueDoctors: uniqueDoctors.length, coverageRate: totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0 } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Monthly visit trend (last 6 months)
router.get('/visit-trend', async (req, res) => {
  try {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const count = await prisma.visit.count({
        where: {
          plannedDate: { gte: start, lte: end },
          status: 'COMPLETED',
          ...((['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) ? { userId: req.user!.userId } : {}),
        },
      });
      months.push({
        month: start.toLocaleString('default', { month: 'short', year: '2-digit' }),
        visits: count,
      });
    }
    res.json({ success: true, data: months });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Team productivity (manager view)
router.get('/team-productivity', async (req, res) => {
  try {
    const teamMembers = await prisma.user.findMany({
      where: { managerId: req.user!.userId, isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true },
    });

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const productivity = await Promise.all(
      teamMembers.map(async (member) => {
        const [planned, completed] = await Promise.all([
          prisma.visit.count({ where: { userId: member.id, plannedDate: { gte: startOfMonth } } }),
          prisma.visit.count({ where: { userId: member.id, plannedDate: { gte: startOfMonth }, status: 'COMPLETED' } }),
        ]);
        return { ...member, planned, completed, rate: planned > 0 ? Math.round((completed / planned) * 100) : 0 };
      }),
    );

    res.json({ success: true, data: productivity });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Doctor classification breakdown
router.get('/doctor-classification', async (req, res) => {
  try {
    const where: any = { deletedAt: null, isActive: true };
    if (['MR', 'TRADE_REP'].includes(req.user!.role)) {
      const territories = await prisma.userTerritory.findMany({ where: { userId: req.user!.userId }, select: { territoryId: true } });
      where.territoryId = { in: territories.map((t) => t.territoryId) };
    }
    const breakdown = await prisma.doctor.groupBy({ by: ['classification'], where, _count: true });
    res.json({ success: true, data: breakdown });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// Visit today stats (KPIs)
router.get('/visit-today-stats', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const where: any = {
      plannedDate: { gte: today, lt: tomorrow },
      ...((['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) ? { userId: req.user!.userId } : {}),
    };
    const [planned, completed, missed, pending] = await Promise.all([
      prisma.visit.count({ where }),
      prisma.visit.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.visit.count({ where: { ...where, status: 'MISSED' } }),
      prisma.visit.count({ where: { ...where, approvalStatus: 'PENDING', status: 'COMPLETED' } }),
    ]);
    res.json({ success: true, data: { planned, completed, missed, pending } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Top visited doctors
router.get('/top-doctors', async (req, res) => {
  try {
    const where: any = { status: 'COMPLETED', visitType: 'DOCTOR', doctorId: { not: null } };
    if (['MR', 'TRADE_REP'].includes(req.user!.role)) where.userId = req.user!.userId;
    const grouped = await prisma.visit.groupBy({
      by: ['doctorId'], where,
      _count: { doctorId: true },
      orderBy: { _count: { doctorId: 'desc' } },
      take: 10,
    });
    const doctorIds = grouped.map((g) => g.doctorId!).filter(Boolean);
    const doctors = await prisma.doctor.findMany({ where: { id: { in: doctorIds } }, select: { id: true, firstName: true, lastName: true, specialty: true, classification: true } });
    const docMap = Object.fromEntries(doctors.map((d) => [d.id, d]));
    res.json({ success: true, data: grouped.map((g) => ({ ...docMap[g.doctorId!], visits: g._count.doctorId })) });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Retailer visit coverage
router.get('/retailer-coverage', async (req, res) => {
  try {
    const where: any = { visitType: 'RETAILER' };
    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) where.userId = req.user!.userId;
    const [total, completed, uniqueRetailers, totalRetailers] = await Promise.all([
      prisma.visit.count({ where }),
      prisma.visit.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.visit.groupBy({ by: ['retailerId'], where: { ...where, status: 'COMPLETED', retailerId: { not: null } } }),
      prisma.retailer.count(),
    ]);
    res.json({ success: true, data: { total, completed, uniqueRetailers: uniqueRetailers.length, totalRetailers, coverageRate: totalRetailers > 0 ? Math.round((uniqueRetailers.length / totalRetailers) * 100) : 0 } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Distributor stats
router.get('/distributor-stats', async (req, res) => {
  try {
    const [total, overCredit, totalOutstanding, totalLimit] = await Promise.all([
      prisma.distributor.count(),
      prisma.distributor.count({ where: { outstandingAmount: { gt: prisma.distributor.fields.creditLimit } } }).catch(() => 0),
      prisma.distributor.aggregate({ _sum: { outstandingAmount: true } }),
      prisma.distributor.aggregate({ _sum: { creditLimit: true } }),
    ]);
    res.json({ success: true, data: {
      total,
      totalOutstanding: totalOutstanding._sum.outstandingAmount || 0,
      totalCreditLimit: totalLimit._sum.creditLimit || 0,
      utilizationRate: (totalLimit._sum.creditLimit || 0) > 0 ? Math.round(((totalOutstanding._sum.outstandingAmount || 0) / (totalLimit._sum.creditLimit || 1)) * 100) : 0,
    }});
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Order pipeline stats
router.get('/order-stats', async (req, res) => {
  try {
    const where: any = {};
    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) where.userId = req.user!.userId;
    const [byStatus, totalRevenue] = await Promise.all([
      prisma.order.groupBy({ by: ['status'], where, _count: true }),
      prisma.order.aggregate({ _sum: { totalAmount: true }, where: { ...where, status: 'DELIVERED' } }),
    ]);
    res.json({ success: true, data: { byStatus, totalRevenue: totalRevenue._sum.totalAmount || 0 } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Visit type breakdown (DOCTOR / RETAILER / DISTRIBUTOR)
router.get('/visit-type-breakdown', async (req, res) => {
  try {
    const where: any = { status: 'COMPLETED' };
    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) where.userId = req.user!.userId;
    const breakdown = await prisma.visit.groupBy({ by: ['visitType'], where, _count: true });
    res.json({ success: true, data: breakdown });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Expense summary by type
router.get('/expense-summary', async (req, res) => {
  try {
    const where: any = {};
    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) where.userId = req.user!.userId;
    const byType = await prisma.expense.groupBy({
      by: ['expenseType'],
      where,
      _sum: { amount: true },
      _count: true,
    });
    const totalAmount = byType.reduce((s, c) => s + (c._sum.amount || 0), 0);
    res.json({ success: true, data: { byCategory: byType.map((b) => ({ category: b.expenseType, _sum: b._sum, _count: b._count })), totalAmount } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;

