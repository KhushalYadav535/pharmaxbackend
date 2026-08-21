import prisma from '../config/database';

export const cfaService = {
  async list(filters: any) {
    const { page = 1, limit = 20, hqId, search, isActive } = filters;
    const p = Number(page), l = Number(limit);
    const where: any = {};
    if (hqId) where.hqId = hqId;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) where.name = { contains: search, mode: 'insensitive' };
    const [cfas, total] = await Promise.all([
      prisma.cFA.findMany({ where, include: { hq: { select: { id: true, name: true } }, area: { select: { id: true, name: true } } }, skip: (p - 1) * l, take: l, orderBy: { name: 'asc' } }),
      prisma.cFA.count({ where }),
    ]);
    return { cfas, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    return prisma.cFA.findUnique({ where: { id }, include: { hq: true, area: true, stockists: { select: { id: true, name: true } } } });
  },

  async create(data: any) {
    const count = await prisma.cFA.count();
    const cfaCode = `CFA${String(count + 1).padStart(5, '0')}`;
    return prisma.cFA.create({ data: { ...data, cfaCode } });
  },

  async update(id: string, data: any) {
    return prisma.cFA.update({ where: { id }, data });
  },

  async deactivate(id: string) {
    return prisma.cFA.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
  },
};
