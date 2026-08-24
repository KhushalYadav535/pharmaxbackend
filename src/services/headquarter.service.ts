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
  _count: { select: { employees: true, doctorsHQ: true, retailersHQ: true } },
} as const;

export const headquarterService = {
  async list(filters: any) {
    const { page = 1, limit = 20, search, state } = filters;
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

    return { headquarters, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    return prisma.territory.findUnique({ where: { id }, select: HQ_SELECT });
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
