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

    const members = await Promise.all(
      teamMembers.map(async (member) => {
        const [planned, completed, ordersTotal] = await Promise.all([
          prisma.visit.count({ where: { userId: member.id, plannedDate: { gte: startOfMonth } } }),
          prisma.visit.count({ where: { userId: member.id, plannedDate: { gte: startOfMonth }, status: 'COMPLETED' } }),
          prisma.order.aggregate({ where: { userId: member.id, createdAt: { gte: startOfMonth } }, _sum: { totalAmount: true } }),
        ]);
        return {
          ...member,
          planned,
          completed,
          rate: planned > 0 ? Math.round((completed / planned) * 100) : 0,
          revenue: ordersTotal._sum.totalAmount || 0,
        };
      }),
    );

    // Aggregate totals across the team
    const totalVisits = members.reduce((s, m) => s + m.planned, 0);
    const completedVisits = members.reduce((s, m) => s + m.completed, 0);
    const totalRevenue = members.reduce((s, m) => s + m.revenue, 0);

    res.json({ success: true, data: { members, totalVisits, completedVisits, totalRevenue } });
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

// Day End Summary
router.get('/day-end-summary', async (req, res) => {
  try {
    const dateQuery = req.query.date as string | undefined;
    let istYear: number;
    let istMonth: number;
    let istDate: number;

    const istOffsetMs = 5.5 * 60 * 60 * 1000;

    if (dateQuery && /^\d{4}-\d{2}-\d{2}/.test(dateQuery)) {
      const parts = dateQuery.substring(0, 10).split('-').map(Number);
      istYear = parts[0];
      istMonth = parts[1] - 1;
      istDate = parts[2];
    } else {
      const now = new Date();
      const istNow = new Date(now.getTime() + istOffsetMs);
      istYear = istNow.getUTCFullYear();
      istMonth = istNow.getUTCMonth();
      istDate = istNow.getUTCDate();
    }

    // Start and end of target day in IST (+05:30) converted to UTC
    const istDayStartUtc = new Date(Date.UTC(istYear, istMonth, istDate, 0, 0, 0, 0) - istOffsetMs);
    const istDayEndUtc = new Date(Date.UTC(istYear, istMonth, istDate, 23, 59, 59, 999) - istOffsetMs);

    // Standard UTC day boundaries
    const utcDayStart = new Date(Date.UTC(istYear, istMonth, istDate, 0, 0, 0, 0));
    const utcDayEnd = new Date(Date.UTC(istYear, istMonth, istDate, 23, 59, 59, 999));

    const windowStart = new Date(Math.min(istDayStartUtc.getTime(), utcDayStart.getTime()));
    const windowEnd = new Date(Math.max(istDayEndUtc.getTime(), utcDayEnd.getTime()));
    
    const where: any = {
      ...((['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) ? { userId: req.user!.userId } : {}),
      OR: [
        { plannedDate: { gte: windowStart, lte: windowEnd } },
        { checkInTime: { gte: windowStart, lte: windowEnd } },
        { checkOutTime: { gte: windowStart, lte: windowEnd } },
        { reportSubmittedAt: { gte: windowStart, lte: windowEnd } },
        { createdAt: { gte: windowStart, lte: windowEnd } },
      ],
    };

    const visits = await prisma.visit.findMany({ 
      where, 
      include: { 
        doctor: true, hospital: true, retailer: true, stockist: true, distributor: true,
        orders: true, sampleDistributions: true 
      },
      orderBy: [{ checkInTime: 'asc' }, { plannedDate: 'asc' }] 
    });

    const planned = visits.length;
    const completed = visits.filter(v => ['COMPLETED', 'REPORTED', 'NEXT_CALL'].includes(v.status)).length;
    const missed = visits.filter(v => v.status === 'MISSED').length;
    
    // Performance
    const totalDuration = visits.reduce((acc, v) => acc + (v.durationMinutes || 0), 0);
    // Estimate travel: completed visits × 5km average
    const totalTravel = completed * 5;

    // Call Breakdown
    const doctors = visits.filter(v => v.visitType === 'DOCTOR' && ['COMPLETED', 'REPORTED', 'NEXT_CALL'].includes(v.status)).length;
    const hospitals = visits.filter(v => v.visitType === 'HOSPITAL' && ['COMPLETED', 'REPORTED', 'NEXT_CALL'].includes(v.status)).length;
    const retailers = visits.filter(v => v.visitType === 'RETAILER' && ['COMPLETED', 'REPORTED', 'NEXT_CALL'].includes(v.status)).length;
    const stockists = visits.filter(v => ['STOCKIST', 'DISTRIBUTOR'].includes(v.visitType) && ['COMPLETED', 'REPORTED', 'NEXT_CALL'].includes(v.status)).length;

    // Business
    let productsDetailed = 0;
    let ordersBooked = 0;
    let samplesDistributed = 0;
    let newOpportunities = 0;

    visits.filter(v => ['COMPLETED', 'REPORTED', 'NEXT_CALL'].includes(v.status)).forEach(v => {
      productsDetailed += v.productsDiscussed?.length || 0;
      newOpportunities += v.businessSignal?.length || 0;
      (v.orders || []).forEach(o => ordersBooked += (o.totalAmount || 0));
      (v.sampleDistributions || []).forEach(s => samplesDistributed += (s.quantity || 0));
    });

    // Engagement
    const positive = visits.filter(v => v.engagement === 'High' || v.engagement === 'Positive' || v.engagement === 'Very Positive').length;
    const neutral = visits.filter(v => v.engagement === 'Medium' || v.engagement === 'Neutral').length;
    const negative = visits.filter(v => v.engagement === 'Low' || v.engagement === 'Negative' || v.engagement === 'Very Negative').length;

    // Timeline
    const timeline = visits.map(v => {
      let targetName = 'Unknown';
      let targetSub = '';
      if (v.visitType === 'DOCTOR' && v.doctor) { targetName = `Dr. ${v.doctor.firstName} ${v.doctor.lastName}`; targetSub = v.doctor.specialty || ''; }
      else if (v.visitType === 'HOSPITAL' && v.hospital) { targetName = v.hospital.name; targetSub = v.hospital.type || 'Hospital'; }
      else if (v.visitType === 'RETAILER' && v.retailer) { targetName = v.retailer.name; targetSub = v.retailer.city || 'Pharmacy'; }
      else if (v.visitType === 'STOCKIST' && v.stockist) { targetName = v.stockist.name; targetSub = 'Stockist'; }
      else if (v.visitType === 'DISTRIBUTOR' && (v.distributor || v.stockist)) { targetName = v.distributor?.name || v.stockist?.name; targetSub = 'Distributor'; }

      const ordersAmount = Array.isArray(v.orders)
        ? v.orders.reduce((acc: number, o: any) => acc + (o.totalAmount || 0), 0)
        : 0;
      const samplesCount = Array.isArray(v.sampleDistributions)
        ? v.sampleDistributions.reduce((acc: number, s: any) => acc + (s.quantity || 0), 0)
        : 0;

      return {
        id: v.id,
        time: v.checkInTime ? v.checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (v.plannedDate ? v.plannedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'),
        targetName,
        targetSub,
        type: v.visitType,
        status: v.status,
        engagement: v.engagement,
        duration: v.durationMinutes,
        ordersAmount,
        samplesCount,
      };
    });

    // Attendance for the specified date
    const attendance = await prisma.attendance.findFirst({
      where: {
        userId: req.user!.userId,
        OR: [
          { date: { gte: windowStart, lte: windowEnd } },
          { checkInTime: { gte: windowStart, lte: windowEnd } }
        ]
      }
    });

    // Pending & Attention
    const sevenDaysFromNow = new Date(windowEnd);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    const followUpsDue = await prisma.visit.count({
      where: {
        ...((['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) ? { userId: req.user!.userId } : {}),
        nextFollowUpDate: { gte: windowStart, lt: sevenDaysFromNow }
      }
    });

    const pendingOrders = await prisma.order.findMany({
      where: {
        ...((['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) ? { userId: req.user!.userId } : {}),
        status: 'DRAFT'
      }
    });
    const ordersPendingCount = pendingOrders.length;
    const ordersPendingAmount = pendingOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);

    const expensesUnsubmitted = await prisma.expense.count({
      where: {
        ...((['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) ? { userId: req.user!.userId } : {}),
        approvalStatus: 'PENDING',
        createdAt: { gte: windowStart, lte: windowEnd }
      }
    });

    res.json({
      success: true,
      data: {
        dateStr: `${istYear}-${String(istMonth + 1).padStart(2, '0')}-${String(istDate).padStart(2, '0')}`,
        performance: { planned, completed, missed, totalDuration, totalTravel },
        callBreakdown: { doctors, hospitals, retailers, stockists },
        business: { productsDetailed, ordersBooked, samplesDistributed, newOpportunities },
        engagement: { positive, neutral, negative },
        timeline,
        attendance,
        pendingAttention: {
          followUpsDue,
          ordersPendingCount,
          ordersPendingAmount,
          expensesUnsubmitted
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Duplicate day-end-summary removed — see consolidated route above (line 217)

export default router;
