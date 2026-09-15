import prisma from '../config/database';

const HQ_SELECT = {
  id: true,
  name: true,
  code: true,
  district: true,
  state: true,
  region: true,
  zone: true,
  pinCode: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      employees: true,
      doctorsHQ: true,
      retailersHQ: true,
      hospitalsHQ: true,
      stockists: true,
      distributors: true,
    }
  },
} as const;

export const headquarterService = {
  async list(filters: any) {
    const { page = 1, limit = 50, search, state } = filters;
    const p = Number(page), l = Number(limit);
    const where: any = {};

    if (state) where.state = state;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { district: { contains: search, mode: 'insensitive' } },
        { state: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [headquarters, total] = await Promise.all([
      prisma.territory.findMany({
        where,
        select: HQ_SELECT,
        skip: (p - 1) * l,
        take: l,
        orderBy: { name: 'asc' },
      }),
      prisma.territory.count({ where }),
    ]);

    const formattedHqs = headquarters.map((h: any) => ({
      ...h,
      _count: {
        ...h._count,
        doctors: h._count?.doctorsHQ ?? 0,
        hospitals: h._count?.hospitalsHQ ?? 0,
        retailers: h._count?.retailersHQ ?? 0,
        employees: h._count?.employees ?? 0,
        stockists: h._count?.stockists ?? 0,
        distributors: h._count?.distributors ?? 0,
      }
    }));

    return { headquarters: formattedHqs, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    const h = await prisma.territory.findUnique({ where: { id }, select: HQ_SELECT });
    if (!h) return null;
    return {
      ...h,
      _count: {
        ...h._count,
        doctors: (h as any)._count?.doctorsHQ ?? 0,
        hospitals: (h as any)._count?.hospitalsHQ ?? 0,
        retailers: (h as any)._count?.retailersHQ ?? 0,
        employees: (h as any)._count?.employees ?? 0,
        stockists: (h as any)._count?.stockists ?? 0,
        distributors: (h as any)._count?.distributors ?? 0,
      }
    };
  },

  async create(data: {
    name: string;
    state: string;
    district?: string;
    region?: string;
    zone?: string;
    pinCode?: string;
    parentId?: string;
  }) {
    // Auto-generate code: HQ00001, HQ00002, ...
    const count = await prisma.territory.count();
    const code = `HQ${String(count + 1).padStart(5, '0')}`;
    return prisma.territory.create({
      data: { ...data, code },
      select: HQ_SELECT,
    });
  },

  async update(id: string, data: {
    name?: string;
    state?: string;
    district?: string;
    region?: string;
    zone?: string;
    pinCode?: string;
    parentId?: string;
  }) {
    return prisma.territory.update({
      where: { id },
      data,
      select: HQ_SELECT,
    });
  },

  async deleteById(id: string) {
    return prisma.territory.delete({ where: { id } });
  },
};
