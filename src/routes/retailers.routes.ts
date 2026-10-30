import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { search, page = '1', limit = '20', territoryId, category, approvalStatus } = req.query;
    const where: Prisma.RetailerWhereInput = {
      deletedAt: null,
      isActive: true,
      ...(category && { category: category as any }),
      ...(search && {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { ownerName: { contains: search as string, mode: 'insensitive' } },
          { pharmacistName: { contains: search as string, mode: 'insensitive' } },
          { retailerCode: { contains: search as string, mode: 'insensitive' } },
          { mobileNumber: { contains: search as string, mode: 'insensitive' } },
          { city: { contains: search as string, mode: 'insensitive' } },
        ],
      }),
      ...(territoryId && { territoryId: territoryId as string }),
    };

    const statusFilter = approvalStatus as string;
    if (statusFilter && statusFilter !== 'ALL') {
      where.approvalStatus = statusFilter as any;
    } else if (!statusFilter) {
      // By default, include both APPROVED and PENDING so newly added chemists are visible immediately
      where.approvalStatus = { in: ['APPROVED', 'PENDING'] };
    }

    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(req.user!.role)) {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { hqId: true },
      });
      const territories = await prisma.userTerritory.findMany({ where: { userId: req.user!.userId }, select: { territoryId: true } });
      const hqIds = [
        user?.hqId,
        ...territories.map((t) => t.territoryId),
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
    const [retailers, total] = await Promise.all([
      prisma.retailer.findMany({
        where,
        include: {
          territory: { select: { id: true, name: true } },
          hq: { select: { id: true, name: true } },
          distributor: { select: { id: true, name: true } },
          stockist: { select: { id: true, name: true } },
          area: { select: { id: true, name: true } },
        },
        skip: (p - 1) * l,
        take: l,
        orderBy: { name: 'asc' },
      }),
      prisma.retailer.count({ where }),
    ]);
    res.json({ success: true, data: { retailers, total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const retailer = await prisma.retailer.findUnique({
      where: { id: req.params.id, deletedAt: null },
      include: {
        territory: true,
        hq: true,
        distributor: true,
        stockist: true,
        area: true,
        visits: { orderBy: { checkInTime: 'desc' }, take: 10 },
      },
    });
    if (!retailer) return res.status(404).json({ success: false, message: 'Retailer not found' });
    res.json({ success: true, data: retailer });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auditLog('CREATE', 'Retailer'), async (req, res) => {
  try {
    const { productIds, ...bodyData } = req.body;
    const data: any = { ...bodyData };
    
    // Sanitize dates
    if (data.drugLicenseExpiry) {
      const d = new Date(data.drugLicenseExpiry);
      if (!isNaN(d.getTime())) data.drugLicenseExpiry = d;
      else delete data.drugLicenseExpiry;
    } else {
      delete data.drugLicenseExpiry;
    }

    if (data.dateOfBirth) {
      const d = new Date(data.dateOfBirth);
      if (!isNaN(d.getTime())) data.dateOfBirth = d;
      else delete data.dateOfBirth;
    } else {
      delete data.dateOfBirth;
    }

    if (data.marriageAnniversary) {
      const d = new Date(data.marriageAnniversary);
      if (!isNaN(d.getTime())) data.marriageAnniversary = d;
      else delete data.marriageAnniversary;
    } else {
      delete data.marriageAnniversary;
    }

    // Sanitize numbers
    if (data.potentialScore !== undefined && data.potentialScore !== null) {
      data.potentialScore = Number(data.potentialScore) || 0;
    }
    if (data.visitFrequency !== undefined && data.visitFrequency !== null) {
      data.visitFrequency = Number(data.visitFrequency) || 2;
    }

    // Sanitize empty strings on foreign keys
    const fkFields = ['areaId', 'hqId', 'territoryId', 'stockistId', 'distributorId'];
    for (const f of fkFields) {
      if (data[f] === '' || data[f] === null || data[f] === 'undefined') {
        delete data[f];
      }
    }

    // Sanitize empty strings on enums
    if (!data.gender || data.gender === '') delete data.gender;
    if (!data.maritalStatus || data.maritalStatus === '') delete data.maritalStatus;
    if (!data.category || data.category === '') delete data.category;

    // Sync territory and HQ
    if (!data.territoryId && data.hqId) data.territoryId = data.hqId;
    if (!data.hqId && data.territoryId) data.hqId = data.territoryId;

    if (!data.territoryId && !data.hqId && req.user?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { hqId: true },
      });
      const userTerritory = await prisma.userTerritory.findFirst({
        where: { userId: req.user.userId },
        select: { territoryId: true },
      });
      const hq = user?.hqId || userTerritory?.territoryId;
      if (hq) {
        data.territoryId = hq;
        data.hqId = hq;
      }
    }

    // Auto-generate retailerCode if not provided
    if (!data.retailerCode) {
      const count = await prisma.retailer.count();
      const lastRetailer = await prisma.retailer.findFirst({
        where: { retailerCode: { startsWith: 'RET' } },
        orderBy: { createdAt: 'desc' },
        select: { retailerCode: true },
      });
      let nextNum = count + 1;
      if (lastRetailer?.retailerCode) {
        const match = lastRetailer.retailerCode.match(/RET(\d+)/);
        if (match) {
          const parsed = parseInt(match[1], 10);
          if (parsed >= nextNum) nextNum = parsed + 1;
        }
      }
      data.retailerCode = `RET${String(nextNum).padStart(5, '0')}`;
    }

    // Auto-approve newly created retailers so they are active and immediately visible
    if (!data.approvalStatus) {
      data.approvalStatus = 'APPROVED';
    }

    if (productIds && productIds.length > 0) {
      data.productsSelected = {
        create: productIds.map((id: string) => ({ productId: id }))
      };
    }

    const retailer = await prisma.retailer.create({ data });
    res.status(201).json({ success: true, data: retailer, message: 'Retailer created successfully' });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

router.put('/:id', auditLog('UPDATE', 'Retailer'), async (req, res) => {
  try {
    const { productIds, ...updateData } = req.body;
    const data: any = { ...updateData };

    if (data.drugLicenseExpiry) {
      const d = new Date(data.drugLicenseExpiry);
      if (!isNaN(d.getTime())) data.drugLicenseExpiry = d;
      else delete data.drugLicenseExpiry;
    }

    if (data.dateOfBirth) {
      const d = new Date(data.dateOfBirth);
      if (!isNaN(d.getTime())) data.dateOfBirth = d;
      else delete data.dateOfBirth;
    }

    if (data.marriageAnniversary) {
      const d = new Date(data.marriageAnniversary);
      if (!isNaN(d.getTime())) data.marriageAnniversary = d;
      else delete data.marriageAnniversary;
    }

    if (data.potentialScore !== undefined && data.potentialScore !== null) {
      data.potentialScore = Number(data.potentialScore) || 0;
    }
    if (data.visitFrequency !== undefined && data.visitFrequency !== null) {
      data.visitFrequency = Number(data.visitFrequency) || 2;
    }

    const fkFields = ['areaId', 'hqId', 'territoryId', 'stockistId', 'distributorId'];
    for (const f of fkFields) {
      if (data[f] === '' || data[f] === null || data[f] === 'undefined') {
        data[f] = null;
      }
    }

    if (!data.gender || data.gender === '') data.gender = null;
    if (!data.maritalStatus || data.maritalStatus === '') data.maritalStatus = null;
    if (!data.category || data.category === '') data.category = null;

    if (productIds) {
      data.productsSelected = {
        deleteMany: {},
        create: productIds.map((id: string) => ({ productId: id }))
      };
    }
    const retailer = await prisma.retailer.update({ where: { id: req.params.id as string }, data });
    res.json({ success: true, data: retailer, message: 'Retailer updated successfully' });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/:id', auditLog('DELETE', 'Retailer'), async (req, res) => {
  try {
    await prisma.retailer.update({ where: { id: req.params.id as string }, data: { deletedAt: new Date(), isActive: false } });
    res.json({ success: true, message: 'Retailer deleted' });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;
