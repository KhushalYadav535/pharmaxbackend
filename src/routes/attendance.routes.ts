import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// List attendance — MR sees own, manager sees team
router.get('/', async (req, res) => {
  try {
    const { userId, fromDate, toDate, page = '1', limit = '30' } = req.query;
    const p = parseInt(page as string), l = parseInt(limit as string);
    const where: any = {};
    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) {
      where.userId = req.user!.userId;
    } else if (userId) {
      where.userId = userId;
    }
    if (fromDate) where.date = { ...where.date, gte: new Date(fromDate as string) };
    if (toDate)   where.date = { ...where.date, lte: new Date(toDate as string) };

    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where, skip: (p - 1) * l, take: l,
        orderBy: { date: 'desc' },
        include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
      }),
      prisma.attendance.count({ where }),
    ]);
    res.json({ success: true, data: { records, total, page: p, totalPages: Math.ceil(total / l) } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Clock in for today
router.post('/clock-in', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const existing = await prisma.attendance.findFirst({
      where: { userId: req.user!.userId, date: today },
    });
    if (existing) return res.status(400).json({ success: false, message: 'Already clocked in today' });

    const record = await prisma.attendance.create({
      data: {
        userId: req.user!.userId,
        date: today,
        checkInTime: new Date(),
        status: 'PRESENT',
        checkInLat: req.body.lat,
        checkInLng: req.body.lng,
        notes: req.body.address,
      },
    });
    res.status(201).json({ success: true, data: record });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Clock out
router.patch('/clock-out', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const record = await prisma.attendance.findFirst({
      where: { userId: req.user!.userId, date: today },
    });
    if (!record) return res.status(404).json({ success: false, message: 'No clock-in found for today' });
    if (record.checkOutTime) return res.status(400).json({ success: false, message: 'Already clocked out' });

    const now = new Date();
    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: { checkOutTime: now },
    });
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Today's status
router.get('/today', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const record = await prisma.attendance.findFirst({
      where: { userId: req.user!.userId, date: today },
    });
    res.json({ success: true, data: record });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Monthly summary for current user
router.get('/monthly-summary', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const userId = req.user!.userId;

    const records = await prisma.attendance.findMany({
      where: { userId, date: { gte: startOfMonth, lte: endOfMonth } },
      orderBy: { date: 'asc' },
    });

    const summary = {
      present: records.filter((r) => r.status === 'PRESENT').length,
      absent: records.filter((r) => r.status === 'ABSENT').length,
      halfDay: records.filter((r) => r.status === 'HALF_DAY').length,
      onLeave: records.filter((r) => r.status === 'ON_LEAVE').length,
      total: records.length,
    };

    res.json({ success: true, data: { summary, records } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
