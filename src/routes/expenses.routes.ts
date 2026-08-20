import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import prisma from '../config/database';
import { requireManager } from '../middlewares/rbac.middleware';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const where: any = {};
    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) where.userId = req.user!.userId;
    const expenses = await prisma.expense.findMany({ where, include: { user: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { expenseDate: 'desc' } });
    res.json({ success: true, data: expenses });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const expense = await prisma.expense.create({ data: { ...req.body, userId: req.user!.userId } });
    res.status(201).json({ success: true, data: expense });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

router.patch('/:id/approve', requireManager, async (req, res) => {
  try {
    const expense = await prisma.expense.update({ where: { id: req.params.id as string }, data: { approvalStatus: 'APPROVED', approvedAt: new Date() } });
    res.json({ success: true, data: expense });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

router.patch('/:id/reject', requireManager, async (req, res) => {
  try {
    const expense = await prisma.expense.update({ where: { id: req.params.id as string }, data: { approvalStatus: 'REJECTED', rejectionReason: req.body.reason } });
    res.json({ success: true, data: expense });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;
