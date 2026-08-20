import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// List schemes
router.get('/', async (req, res) => {
  try {
    const { type, active } = req.query;
    const where: any = {};
    if (active !== 'false') where.isActive = true;
    if (type) where.type = type;

    const schemes = await prisma.scheme.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });
    res.json({ success: true, data: schemes });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Create scheme (manager)
router.post('/', requireManager, async (req, res) => {
  try {
    const scheme = await prisma.scheme.create({
      data: {
        ...req.body,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        minPurchase: req.body.minPurchase ? parseFloat(req.body.minPurchase) : undefined,
      },
    });
    res.status(201).json({ success: true, data: scheme });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Toggle active
router.patch('/:id/toggle', requireManager, async (req, res) => {
  try {
    const scheme = await prisma.scheme.findUnique({ where: { id: req.params.id as string } });
    if (!scheme) return res.status(404).json({ success: false, message: 'Not found' });
    const updated = await prisma.scheme.update({
      where: { id: req.params.id as string },
      data: { isActive: !scheme.isActive },
    });
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;
