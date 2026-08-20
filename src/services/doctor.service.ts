import prisma from '../config/database';
import { Prisma, DoctorClassification } from '@prisma/client';

export interface DoctorFilters {
  search?: string;
  specialty?: string;
  classification?: DoctorClassification;
  territoryId?: string;
  hospitalId?: string;
  page?: number;
  limit?: number;
}

export const doctorService = {
  async list(filters: DoctorFilters, userId: string, userRole: string) {
    const {
      search, specialty, classification, territoryId, hospitalId,
      page = 1, limit = 20,
    } = filters;

    const where: Prisma.DoctorWhereInput = {
      deletedAt: null,
      isActive: true,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { specialty: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(specialty && { specialty }),
      ...(classification && { classification }),
      ...(territoryId && { territoryId }),
      ...(hospitalId && { hospitalId }),
    };

    // MR/Rep level: only their territory
    if (['MR', 'TRADE_REP', 'DISTRIBUTOR_REP'].includes(userRole)) {
      const userTerritories = await prisma.userTerritory.findMany({
        where: { userId },
        select: { territoryId: true },
      });
      const tIds = userTerritories.map((ut) => ut.territoryId);
      where.territoryId = { in: tIds };
    }

    const [doctors, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        include: {
          hospital: { select: { id: true, name: true } },
          territory: { select: { id: true, name: true } },
          _count: { select: { visits: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { lastName: 'asc' },
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
        tags: true,
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
      const userTerritories = await prisma.userTerritory.findMany({
        where: { userId }, select: { territoryId: true },
      });
      where.territoryId = { in: userTerritories.map((ut) => ut.territoryId) };
    }

    const [total, byClassification, kolCount] = await Promise.all([
      prisma.doctor.count({ where }),
      prisma.doctor.groupBy({ by: ['classification'], where, _count: true }),
      prisma.doctor.count({ where: { ...where, isKol: true } }),
    ]);

    return { total, byClassification, kolCount };
  },
};
