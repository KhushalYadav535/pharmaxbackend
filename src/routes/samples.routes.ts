import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireManager } from '../middlewares/rbac.middleware';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// List sample products
router.get('/products', async (req, res) => {
  try {
    const products = await prisma.sampleProduct.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: products });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Sample distribution history
router.get('/distributions', async (req, res) => {
  try {
    const { page = '1', limit = '20', doctorId } = req.query;
    const p = parseInt(page as string), l = parseInt(limit as string);
    const where: any = {};
    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) where.userId = req.user!.userId;
    if (doctorId) where.doctorId = doctorId;

    const [distributions, total] = await Promise.all([
      prisma.sampleDistribution.findMany({
        where, skip: (p - 1) * l, take: l,
        orderBy: { distributedAt: 'desc' },
        include: {
          sampleProduct: true,
          doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.sampleDistribution.count({ where }),
    ]);
    res.json({ success: true, data: { distributions, total, page: p, totalPages: Math.ceil(total / l) } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// Distribute sample
router.post('/distribute', async (req, res) => {
  try {
    const { doctorId, sampleProductId, quantity, notes, visitId } = req.body;
    const distribution = await prisma.sampleDistribution.create({
      data: {
        userId: req.user!.userId,
        doctorId,
        sampleProductId,
        quantity: parseInt(quantity),
        notes,
        visitId,
        distributedAt: new Date(),
      },
      include: {
        sampleProduct: true,
        doctor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.status(201).json({ success: true, data: distribution });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// Sample stats summary
router.get('/stats', async (req, res) => {
  try {
    const where: any = {};
    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) where.userId = req.user!.userId;

    const [totalDistributions, byProduct] = await Promise.all([
      prisma.sampleDistribution.count({ where }),
      prisma.sampleDistribution.groupBy({
        by: ['sampleProductId'],
        where,
        _sum: { quantity: true },
        _count: true,
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    // Hydrate product names
    const productIds = byProduct.map((b) => b.sampleProductId);
    const products = await prisma.sampleProduct.findMany({ where: { id: { in: productIds } } });
    const productMap = Object.fromEntries(products.map((p) => [p.id, p.name]));

    res.json({
      success: true,
      data: {
        totalDistributions,
        topProducts: byProduct.map((b) => ({
          productName: productMap[b.sampleProductId] || 'Unknown',
          quantity: b._sum.quantity || 0,
          count: b._count,
        })),
      },
    });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
