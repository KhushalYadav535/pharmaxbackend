import prisma from '../config/database';

export const locationService = {
  async list(filters: any) {
    const { page = 1, limit = 50, hqId, search } = filters;
    const p = Number(page), l = Number(limit);
    const where: any = {};
    if (hqId) where.hqId = hqId;
    if (search) where.name = { contains: search, mode: 'insensitive' };
    const [locations, total] = await Promise.all([
      prisma.location.findMany({ where, include: { hq: { select: { id: true, name: true } } }, skip: (p - 1) * l, take: l, orderBy: { name: 'asc' } }),
      prisma.location.count({ where }),
    ]);
    return { locations, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    return prisma.location.findUnique({ where: { id }, include: { hq: true, areas: true } });
  },

  async create(data: { name: string; district?: string; state?: string; pinCode?: string; hqId?: string }) {
    const count = await prisma.location.count();
    const locationCode = `LOC${String(count + 1).padStart(5, '0')}`;
    return prisma.location.create({ data: { ...data, locationCode } });
  },

  async update(id: string, data: any) {
    return prisma.location.update({ where: { id }, data });
  },

  async deactivate(id: string) {
    return prisma.location.update({ where: { id }, data: { isActive: false } });
  },
};
