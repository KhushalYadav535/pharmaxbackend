import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// List tour plans — MR sees own, manager sees team
router.get('/', async (req, res) => {
  try {
    const { month, userId, status } = req.query;
    const where: any = {};
    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) {
      where.userId = req.user!.userId;
    } else if (userId) {
      where.userId = userId;
    }
    if (month) where.planMonth = month;
    if (status) where.approvalStatus = status;

    const plans = await prisma.tourPlan.findMany({
      where,
      orderBy: { planDate: 'asc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
        beat: { select: { id: true, name: true } },
      },
    });
    res.json({ success: true, data: plans });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Create tour plan entry (FFMS: tourFromDate mandatory)
router.post('/', auditLog('CREATE', 'TourPlan'), async (req, res) => {
  try {
    const { planDate, tourFromDate, tourToDate, tourPurpose, jointVisit, jointVisitWith, beatId, locationId, areaId, hqId, notes, planMonth } = req.body;
    const fromDate = new Date(tourFromDate || planDate);
    const month = planMonth || `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`;
    const plan = await prisma.tourPlan.create({
      data: {
        userId: req.user!.userId,
        tourFromDate: fromDate,
        tourToDate: tourToDate ? new Date(tourToDate) : undefined,
        tourPurpose,
        jointVisit: jointVisit === true || jointVisit === 'true',
        jointVisitWith,
        planDate: fromDate,
        planMonth: month,
        beatId,
        locationId,
        areaId,
        hqId,
        notes,
        approvalStatus: 'PENDING',
      },
    });
    res.status(201).json({ success: true, data: plan });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Bulk create — submit whole month plan
router.post('/bulk', auditLog('CREATE', 'TourPlan'), async (req, res) => {
  try {
    const { plans, planMonth } = req.body; // plans: [{planDate, beatId, notes}]
    const created = await prisma.tourPlan.createMany({
      data: plans.map((p: any) => ({
        userId: req.user!.userId,
        planDate: new Date(p.planDate),
        planMonth,
        beatId: p.beatId || null,
        notes: p.notes || null,
        approvalStatus: 'PENDING',
      })),
    });
    res.status(201).json({ success: true, data: { count: created.count } });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Approve tour plan (manager)
router.patch('/:id/approve', requireManager, auditLog('UPDATE', 'TourPlan'), async (req, res) => {
  try {
    const plan = await prisma.tourPlan.update({
      where: { id: req.params.id as string },
      data: { approvalStatus: 'APPROVED' },
    });
    res.json({ success: true, data: plan });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Reject tour plan (manager)
router.patch('/:id/reject', requireManager, auditLog('UPDATE', 'TourPlan'), async (req, res) => {
  try {
    const plan = await prisma.tourPlan.update({
      where: { id: req.params.id as string },
      data: { approvalStatus: 'REJECTED', notes: req.body.reason },
    });
    res.json({ success: true, data: plan });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Bulk approve all PENDING for a user+month (manager)
router.post('/bulk-approve', requireManager, async (req, res) => {
  try {
    const { userId, planMonth } = req.body;
    const updated = await prisma.tourPlan.updateMany({
      where: { userId, planMonth, approvalStatus: 'PENDING' },
      data: { approvalStatus: 'APPROVED' },
    });
    res.json({ success: true, data: { count: updated.count } });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Get beats list
router.get('/beats', async (req, res) => {
  try {
    const beats = await prisma.beat.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: beats });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Delete a plan entry
router.delete('/:id', auditLog('DELETE', 'TourPlan'), async (req, res) => {
  try {
    await prisma.tourPlan.delete({ where: { id: req.params.id as string } });
    res.json({ success: true, message: 'Plan deleted' });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;
