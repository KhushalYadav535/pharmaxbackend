import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { search, page = '1', limit = '20', territoryId } = req.query;
    const where: Prisma.RetailerWhereInput = {
      deletedAt: null, isActive: true,
      ...(search && { OR: [{ name: { contains: search as string, mode: 'insensitive' } }, { ownerName: { contains: search as string, mode: 'insensitive' } }] }),
      ...(territoryId && { territoryId: territoryId as string }),
    };
    if (['MR', 'TRADE_REP'].includes(req.user!.role)) {
      const territories = await prisma.userTerritory.findMany({ where: { userId: req.user!.userId }, select: { territoryId: true } });
      where.territoryId = { in: territories.map((t) => t.territoryId) };
    }
    const p = parseInt(page as string); const l = parseInt(limit as string);
    const [retailers, total] = await Promise.all([
      prisma.retailer.findMany({ where, include: { territory: { select: { id: true, name: true } }, distributor: { select: { id: true, name: true } } }, skip: (p - 1) * l, take: l, orderBy: { name: 'asc' } }),
      prisma.retailer.count({ where }),
    ]);
    res.json({ success: true, data: { retailers, total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const retailer = await prisma.retailer.findUnique({ where: { id: req.params.id, deletedAt: null }, include: { territory: true, distributor: true, visits: { orderBy: { checkInTime: 'desc' }, take: 10 } } });
    if (!retailer) return res.status(404).json({ success: false, message: 'Retailer not found' });
    res.json({ success: true, data: retailer });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auditLog('CREATE', 'Retailer'), async (req, res) => {
  try {
    const retailer = await prisma.retailer.create({ data: req.body });
    res.status(201).json({ success: true, data: retailer });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

router.put('/:id', auditLog('UPDATE', 'Retailer'), async (req, res) => {
  try {
    const retailer = await prisma.retailer.update({ where: { id: req.params.id as string }, data: req.body });
    res.json({ success: true, data: retailer });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/:id', auditLog('DELETE', 'Retailer'), async (req, res) => {
  try {
    await prisma.retailer.update({ where: { id: req.params.id as string }, data: { deletedAt: new Date(), isActive: false } });
    res.json({ success: true, message: 'Retailer deleted' });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;
