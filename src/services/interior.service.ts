import prisma from '../config/database';

export const interiorService = {
  async list(filters: any) {
    const { page = 1, limit = 50, locationId, search, isActive } = filters;
    const p = Number(page), l = Number(limit);
    const where: any = {};
    if (locationId) where.locationId = locationId;
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [interiors, total] = await Promise.all([
      prisma.interior.findMany({
        where,
        include: { location: { select: { id: true, name: true } } },
        skip: (p - 1) * l,
        take: l,
        orderBy: { name: 'asc' },
      }),
      prisma.interior.count({ where }),
    ]);
    return { interiors, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    return prisma.interior.findUnique({ where: { id }, include: { location: true } });
  },

  async create(data: any) {
    const count = await prisma.interior.count();
    const interiorCode = `INT${String(count + 1).padStart(5, '0')}`;
    return prisma.interior.create({ data: { ...data, interiorCode } });
  },

  async update(id: string, data: any) {
    return prisma.interior.update({ where: { id }, data });
  },

  async deactivate(id: string) {
    return prisma.interior.update({ where: { id }, data: { isActive: false } });
  },

  async reactivate(id: string) {
    return prisma.interior.update({ where: { id }, data: { isActive: true } });
  },

  async deleteById(id: string) {
    return prisma.interior.delete({ where: { id } });
  },
};
