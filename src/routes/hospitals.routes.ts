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
    const where: Prisma.HospitalWhereInput = {
      deletedAt: null, isActive: true,
      ...(search && { name: { contains: search as string, mode: 'insensitive' } }),
    };
    const p = parseInt(page as string); const l = parseInt(limit as string);
    const [hospitals, total] = await Promise.all([
      prisma.hospital.findMany({ where, include: { territory: { select: { id: true, name: true } }, _count: { select: { doctors: true } } }, skip: (p - 1) * l, take: l, orderBy: { name: 'asc' } }),
      prisma.hospital.count({ where }),
    ]);
    res.json({ success: true, data: { hospitals, total, page: p, totalPages: Math.ceil(total / l) } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const hospital = await prisma.hospital.findUnique({ where: { id: req.params.id, deletedAt: null }, include: { territory: true, doctors: { select: { id: true, firstName: true, lastName: true, specialty: true } }, visits: { orderBy: { checkInTime: 'desc' }, take: 10 } } });
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });
    res.json({ success: true, data: hospital });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auditLog('CREATE', 'Hospital'), async (req, res) => {
  try {
    const { name, category, type, city, state, phone, beds, isActive, territoryId } = req.body;
    
    // Support either 'category' from frontend or 'type' directly
    const hospitalType = category || type;

    const data: any = {
      name,
      type: hospitalType,
      city,
      state,
      phone,
      beds: beds ? Number(beds) : undefined,
      isActive: isActive !== undefined ? isActive : true,
    };

    if (territoryId) {
      data.territoryId = territoryId;
    } else {
      // Auto-assign territory based on logged-in user if available
      const userTerritory = await prisma.userTerritory.findFirst({
        where: { userId: req.user!.userId }
      });
      if (userTerritory) data.territoryId = userTerritory.territoryId;
    }

    const h = await prisma.hospital.create({ data });
    res.status(201).json({ success: true, data: h });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

router.put('/:id', auditLog('UPDATE', 'Hospital'), async (req, res) => {
  try {
    const h = await prisma.hospital.update({ where: { id: req.params.id as string }, data: req.body });
    res.json({ success: true, data: h });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;
