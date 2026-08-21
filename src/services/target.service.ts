import prisma from '../config/database';

export const targetService = {
  async list(filters: any) {
    const { page = 1, limit = 20, hqId, year } = filters;
    const p = Number(page), l = Number(limit);
    const where: any = {};
    if (hqId) where.hqId = hqId;
    if (year) where.targetYear = Number(year);
    const [targets, total] = await Promise.all([
      prisma.target.findMany({
        where,
        include: { hq: { select: { id: true, name: true } } },
        skip: (p - 1) * l,
        take: l,
        orderBy: { targetYear: 'desc' },
      }),
      prisma.target.count({ where }),
    ]);
    return { targets, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    return prisma.target.findUnique({ where: { id }, include: { hq: true } });
  },

  async create(data: { targetYear: number; targetAmount: number; hqId: string }) {
    return prisma.target.create({ data });
  },

  async update(id: string, data: any) {
    return prisma.target.update({ where: { id }, data });
  },
};
