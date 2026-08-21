import prisma from '../config/database';

export const stockistService = {
  async list(filters: any) {
    const { page = 1, limit = 20, hqId, cfaId, search, isActive } = filters;
    const p = Number(page), l = Number(limit);
    const where: any = {};
    if (hqId) where.hqId = hqId;
    if (cfaId) where.cfaId = cfaId;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) where.name = { contains: search, mode: 'insensitive' };
    const [stockists, total] = await Promise.all([
      prisma.stockist.findMany({ where, include: { hq: { select: { id: true, name: true } }, area: { select: { id: true, name: true } }, cfa: { select: { id: true, name: true } } }, skip: (p - 1) * l, take: l, orderBy: { name: 'asc' } }),
      prisma.stockist.count({ where }),
    ]);
    return { stockists, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    return prisma.stockist.findUnique({ where: { id }, include: { hq: true, area: true, cfa: true, retailers: { select: { id: true, name: true } } } });
  },

  async create(data: any) {
    const count = await prisma.stockist.count();
    const stockistCode = `STK${String(count + 1).padStart(5, '0')}`;
    return prisma.stockist.create({ data: { ...data, stockistCode } });
  },

  async update(id: string, data: any) {
    return prisma.stockist.update({ where: { id }, data });
  },

  async deactivate(id: string) {
    return prisma.stockist.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
  },
};
