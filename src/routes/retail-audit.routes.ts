import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// GET all audits (with filters)
router.get('/', async (req, res) => {
  try {
    const { retailerId, page = '1', limit = '20', startDate, endDate } = req.query;
    const p = parseInt(page as string); const l = parseInt(limit as string);
    const where: any = {};
    if (retailerId) where.retailerId = retailerId;
    if (['MR', 'TRADE_REP'].includes(req.user!.role)) {
      where.userId = req.user!.userId;
    }
    if (startDate || endDate) {
      where.auditDate = {};
      if (startDate) where.auditDate.gte = new Date(startDate as string);
      if (endDate) where.auditDate.lte = new Date(endDate as string);
    }
    const [audits, total] = await Promise.all([
      prisma.retailAudit.findMany({
        where,
        include: {
          retailer: { select: { id: true, name: true, city: true, category: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
        skip: (p - 1) * l,
        take: l,
        orderBy: { auditDate: 'desc' },
      }),
      prisma.retailAudit.count({ where }),
    ]);
    res.json({ success: true, data: { audits, total, page: p, totalPages: Math.ceil(total / l) } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// GET single audit
router.get('/:id', async (req, res) => {
  try {
    const audit = await prisma.retailAudit.findUnique({
      where: { id: req.params.id },
      include: {
        retailer: true,
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });
    if (!audit) return res.status(404).json({ success: false, message: 'Audit not found' });
    res.json({ success: true, data: audit });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// GET audits by retailer
router.get('/retailer/:retailerId', async (req, res) => {
  try {
    const audits = await prisma.retailAudit.findMany({
      where: { retailerId: req.params.retailerId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { auditDate: 'desc' },
      take: 20,
    });
    res.json({ success: true, data: audits });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// POST create audit
router.post('/', auditLog('CREATE', 'RetailAudit'), async (req, res) => {
  try {
    const {
      retailerId, auditDate, shelfSharePercent, productPlacement,
      priceCompliance, competitorVisibility, stockAvailability, outOfStock,
      displayCompliance, competitorSchemes, notes, photoUrls,
    } = req.body;

    // Calculate score
    let score = 0;
    if (shelfSharePercent >= 30) score += 25;
    else if (shelfSharePercent >= 15) score += 15;
    if (productPlacement >= 4) score += 20;
    else if (productPlacement >= 3) score += 12;
    if (priceCompliance) score += 20;
    if (displayCompliance) score += 20;
    if (!competitorVisibility) score += 15;

    const audit = await prisma.retailAudit.create({
      data: {
        retailerId,
        userId: req.user!.userId,
        auditDate: auditDate ? new Date(auditDate) : new Date(),
        shelfSharePercent: shelfSharePercent ? parseFloat(shelfSharePercent) : null,
        productPlacement: productPlacement ? parseInt(productPlacement) : null,
        priceCompliance: Boolean(priceCompliance),
        competitorVisibility: Boolean(competitorVisibility),
        stockAvailability: stockAvailability || [],
        outOfStock: outOfStock || [],
        displayCompliance: Boolean(displayCompliance),
        competitorSchemes,
        notes,
        photoUrls: photoUrls || [],
        totalScore: score,
      },
      include: {
        retailer: { select: { id: true, name: true, city: true } },
      },
    });
    res.status(201).json({ success: true, data: audit });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// PUT update audit
router.put('/:id', auditLog('UPDATE', 'RetailAudit'), async (req, res) => {
  try {
    const audit = await prisma.retailAudit.update({
      where: { id: req.params.id as string },
      data: req.body,
    });
    res.json({ success: true, data: audit });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

// GET audit stats summary
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = ['MR', 'TRADE_REP'].includes(req.user!.role) ? req.user!.userId : undefined;
    const where = userId ? { userId } : {};
    const [totalAudits, avgScore, recentAudits] = await Promise.all([
      prisma.retailAudit.count({ where }),
      prisma.retailAudit.aggregate({ where, _avg: { totalScore: true } }),
      prisma.retailAudit.findMany({
        where,
        include: { retailer: { select: { name: true, city: true } } },
        orderBy: { auditDate: 'desc' },
        take: 5,
      }),
    ]);
    res.json({ success: true, data: { totalAudits, avgScore: avgScore._avg.totalScore || 0, recentAudits } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
