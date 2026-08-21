import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    const where: Prisma.DistributorWhereInput = {
      deletedAt: null, isActive: true, approvalStatus: (req.query.approvalStatus as any) || 'APPROVED',
      ...(search && { OR: [{ name: { contains: search as string, mode: 'insensitive' } }] }),
    };
    const p = parseInt(page as string); const l = parseInt(limit as string);
    const [distributors, total] = await Promise.all([
      prisma.distributor.findMany({ where, include: { territory: { select: { id: true, name: true } } }, skip: (p - 1) * l, take: l, orderBy: { name: 'asc' } }),
      prisma.distributor.count({ where }),
    ]);
    res.json({ success: true, data: { distributors, total, page: p, totalPages: Math.ceil(total / l) } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const dist = await prisma.distributor.findUnique({ where: { id: req.params.id, deletedAt: null }, include: { territory: true, retailers: { select: { id: true, name: true, city: true } }, visits: { orderBy: { checkInTime: 'desc' }, take: 10 } } });
    if (!dist) return res.status(404).json({ success: false, message: 'Distributor not found' });
    res.json({ success: true, data: dist });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auditLog('CREATE', 'Distributor'), async (req, res) => {
  try {
    const data = { ...req.body };
    
    if (data.creditLimit) data.creditLimit = Number(data.creditLimit);
    if (data.creditDays) data.creditDays = Number(data.creditDays);
    if (data.outstandingAmount) data.outstandingAmount = Number(data.outstandingAmount);

    if (!data.territoryId) {
      const userTerritory = await prisma.userTerritory.findFirst({
        where: { userId: req.user!.userId }
      });
      if (userTerritory) data.territoryId = userTerritory.territoryId;
    }

    const dist = await prisma.distributor.create({ data });
    res.status(201).json({ success: true, data: dist });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

router.put('/:id', auditLog('UPDATE', 'Distributor'), async (req, res) => {
  try {
    const dist = await prisma.distributor.update({ where: { id: req.params.id as string }, data: req.body });
    res.json({ success: true, data: dist });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/:id', auditLog('DELETE', 'Distributor'), async (req, res) => {
  try {
    await prisma.distributor.update({ where: { id: req.params.id as string }, data: { deletedAt: new Date(), isActive: false } });
    res.json({ success: true, message: 'Distributor deleted' });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;

