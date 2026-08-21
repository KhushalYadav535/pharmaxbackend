import prisma from '../config/database';

export const areaService = {
  async list(filters: any) {
    const { page = 1, limit = 50, locationId, hqId, search } = filters;
    const p = Number(page), l = Number(limit);
    const where: any = {};
    if (locationId) where.locationId = locationId;
    if (hqId) where.hqId = hqId;
    if (search) where.name = { contains: search, mode: 'insensitive' };
    const [areas, total] = await Promise.all([
      prisma.area.findMany({ where, include: { location: { select: { id: true, name: true } }, hq: { select: { id: true, name: true } } }, skip: (p - 1) * l, take: l, orderBy: { name: 'asc' } }),
      prisma.area.count({ where }),
    ]);
    return { areas, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    return prisma.area.findUnique({ where: { id }, include: { location: true, hq: true } });
  },

  async create(data: { name: string; locationId?: string; hqId?: string }) {
    const count = await prisma.area.count();
    const areaCode = `AREA${String(count + 1).padStart(5, '0')}`;
    return prisma.area.create({ data: { ...data, areaCode } });
  },

  async update(id: string, data: any) {
    return prisma.area.update({ where: { id }, data });
  },

  async deactivate(id: string) {
    return prisma.area.update({ where: { id }, data: { isActive: false } });
  },
};
