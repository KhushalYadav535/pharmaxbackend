import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { search, page = '1', limit = '20', approvalStatus } = req.query;
    const where: Prisma.HospitalWhereInput = {
      deletedAt: null,
      isActive: true,
      ...(search && { name: { contains: search as string, mode: 'insensitive' } }),
    };

    const statusFilter = approvalStatus as string;
    if (statusFilter && statusFilter !== 'ALL') {
      where.approvalStatus = statusFilter as any;
    } else if (!statusFilter) {
      where.approvalStatus = { in: ['APPROVED', 'PENDING'] };
    }

    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { hqId: true },
      });
      const userTerritories = await prisma.userTerritory.findMany({
        where: { userId: req.user!.userId },
        select: { territoryId: true },
      });
      const hqIds = [
        user?.hqId,
        ...userTerritories.map((ut) => ut.territoryId),
      ].filter(Boolean) as string[];

      if (hqIds.length > 0) {
        where.AND = [
          ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
          {
            OR: [
              { hqId: { in: hqIds } },
              { territoryId: { in: hqIds } },
            ],
          },
        ];
      } else {
        where.id = '__none__';
      }
    }

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
    const { name, category, type, city, district, state, phone, beds, isActive, territoryId, hqId, cfaId, gstinNumber, panNumber, geoTag, visitDays, productIds } = req.body;
    
    // Support either 'category' from frontend or 'type' directly
    const hospitalType = type; // Keep type separate, category is now its own field

    const data: any = {
      ...req.body,
      type: hospitalType,
      category,
      city,
      district,
      state,
      phone,
      hqId,
      cfaId,
      gstinNumber,
      panNumber,
      geoTag,
      visitDays: visitDays || [],
      beds: beds ? Number(beds) : undefined,
      isActive: isActive !== undefined ? isActive : true,
    };

    if (productIds && productIds.length > 0) {
      data.productsSelected = {
        create: productIds.map((id: string) => ({ productId: id }))
      };
      delete data.productIds;
    }

    if (territoryId) {
      data.territoryId = territoryId;
    } else {
      // Auto-assign territory based on logged-in user if available
      const userTerritory = await prisma.userTerritory.findFirst({
        where: { userId: req.user!.userId }
      });
      if (userTerritory) data.territoryId = userTerritory.territoryId;
    }

    if (!data.approvalStatus) {
      data.approvalStatus = 'APPROVED';
    }

    const fkFields = ['areaId', 'hqId', 'territoryId', 'cfaId'];
    for (const f of fkFields) {
      if (data[f] === '' || data[f] === null) {
        delete data[f];
      }
    }

    const h = await prisma.hospital.create({ data });
    res.status(201).json({ success: true, data: h });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

router.put('/:id', auditLog('UPDATE', 'Hospital'), async (req, res) => {
  try {
    const { productIds, ...updateData } = req.body;
    const data: any = { ...updateData };

    if (productIds) {
      data.productsSelected = {
        deleteMany: {},
        create: productIds.map((id: string) => ({ productId: id }))
      };
    }

    const h = await prisma.hospital.update({ where: { id: req.params.id as string }, data });
    res.json({ success: true, data: h });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;

