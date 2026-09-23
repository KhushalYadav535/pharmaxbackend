import prisma from '../config/database';
import { Prisma, DoctorClassification } from '@prisma/client';

export interface DoctorFilters {
  search?: string;
  specialty?: string;
  category?: string;
  classification?: DoctorClassification;
  territoryId?: string;
  hqId?: string;
  areaId?: string;
  hospitalId?: string;
  approvalStatus?: 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
  page?: number;
  limit?: number;
}

export const doctorService = {
  async list(filters: DoctorFilters, userId: string, userRole: string) {
    const {
      search, specialty, category, classification, territoryId, hqId, areaId, hospitalId, approvalStatus,
      page = 1, limit = 20,
    } = filters;

    const andConditions: Prisma.DoctorWhereInput[] = [
      { deletedAt: null, isActive: true },
    ];

    if (approvalStatus && approvalStatus !== 'ALL') {
      andConditions.push({ approvalStatus: approvalStatus as any });
    } else if (!approvalStatus) {
      andConditions.push({ approvalStatus: 'APPROVED' });
    }

    if (search) {
      andConditions.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { specialty: { contains: search, mode: 'insensitive' } },
          { doctorCode: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
          { qualification: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (specialty) andConditions.push({ specialty });
    if (category) andConditions.push({ category });
    if (classification) andConditions.push({ classification });
    if (territoryId) andConditions.push({ territoryId });
    if (hqId) {
      andConditions.push({
        OR: [{ hqId }, { territoryId: hqId }],
      });
    }
    if (areaId) andConditions.push({ areaId });
    if (hospitalId) andConditions.push({ hospitalId });

    // MR/Rep level: only their assigned Headquarter(s)
    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(userRole)) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { hqId: true },
      });
      const userTerritories = await prisma.userTerritory.findMany({
        where: { userId },
        select: { territoryId: true },
      });
      const hqIds = [
        user?.hqId,
        ...userTerritories.map((ut) => ut.territoryId),
      ].filter(Boolean) as string[];

      if (hqIds.length > 0) {
        andConditions.push({
          OR: [
            { hqId: { in: hqIds } },
            { territoryId: { in: hqIds } },
          ],
        });
      } else {
        andConditions.push({ id: '__none__' });
      }
    }

    const where: Prisma.DoctorWhereInput = { AND: andConditions };

    const [doctors, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        include: {
          hospital: { select: { id: true, name: true } },
          territory: { select: { id: true, name: true } },
          hq: { select: { id: true, name: true } },
          area: { select: { id: true, name: true } },
          productsSelected: {
            include: { product: { select: { id: true, name: true, productCode: true } } },
          },
          _count: { select: { visits: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ doctorCode: 'asc' }, { lastName: 'asc' }],
      }),
      prisma.doctor.count({ where }),
    ]);

    return { doctors, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getById(id: string) {
    return prisma.doctor.findUnique({
      where: { id, deletedAt: null },
      include: {
        hospital: true,
        territory: true,
        hq: true,
        area: true,
        retailer: true,
        tags: true,
        productsSelected: {
          include: { product: true },
        },
        visits: {
          orderBy: { checkInTime: 'desc' },
          take: 10,
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        sampleDistributions: {
          orderBy: { distributedAt: 'desc' },
          take: 5,
          include: { sampleProduct: true },
        },
      },
    });
  },

  async create(data: Prisma.DoctorCreateInput) {
    return prisma.doctor.create({ data });
  },

  async update(id: string, data: Prisma.DoctorUpdateInput) {
    return prisma.doctor.update({ where: { id }, data });
  },

  async softDelete(id: string) {
    return prisma.doctor.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  },

  async getStats(userId: string, userRole: string) {
    const where: Prisma.DoctorWhereInput = { deletedAt: null, isActive: true };
    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(userRole)) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { hqId: true },
      });
      const userTerritories = await prisma.userTerritory.findMany({
        where: { userId },
        select: { territoryId: true },
      });
      const hqIds = [
        user?.hqId,
        ...userTerritories.map((ut) => ut.territoryId),
      ].filter(Boolean) as string[];

      if (hqIds.length > 0) {
        where.OR = [
          { hqId: { in: hqIds } },
          { territoryId: { in: hqIds } },
        ];
      } else {
        where.id = '__none__';
      }
    }

    const [total, byClassification, kolCount] = await Promise.all([
      prisma.doctor.count({ where }),
      prisma.doctor.groupBy({ by: ['classification'], where, _count: true }),
      prisma.doctor.count({ where: { ...where, isKol: true } }),
    ]);

    return { total, byClassification, kolCount };
  },
};
