import prisma from '../config/database';

export const targetService = {
  async list(filters: any) {
    const { page = 1, limit = 20, targetYear, targetMonth, hqId } = filters;
    const p = Number(page), l = Number(limit);
    
    const where: any = {};
    if (targetYear) where.targetYear = Number(targetYear);
    if (targetMonth === 'annual' || targetMonth === 'null') {
      where.targetMonth = null;
    } else if (targetMonth) {
      where.targetMonth = Number(targetMonth);
    }
    if (hqId) where.hqId = hqId;

    const [targets, total] = await Promise.all([
      prisma.target.findMany({
        where,
        include: { hq: { select: { id: true, name: true, code: true } } },
        skip: (p - 1) * l,
        take: l,
        orderBy: [{ targetYear: 'desc' }, { targetMonth: 'desc' }]
      }),
      prisma.target.count({ where })
    ]);

    return { targets, total, page: p, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    const target = await prisma.target.findUnique({
      where: { id },
      include: { hq: { select: { id: true, name: true, code: true } } }
    });
    if (!target) throw new Error('Target not found');
    return target;
  },

  async create(data: any) {
    const { targetYear, targetMonth, targetAmount, hqId } = data;
    
    if (!targetYear || !targetAmount || !hqId) {
      throw new Error('Year, Amount, and Headquarter are required');
    }

    const tMonth = targetMonth ? Number(targetMonth) : null;

    // Check if target for this HQ, year and month already exists
    const existing = await prisma.target.findFirst({
      where: { hqId, targetYear: Number(targetYear), targetMonth: tMonth }
    });
    
    if (existing) {
      const monthStr = tMonth ? `Month ${tMonth}/` : '';
      throw new Error(`Target for this Headquarter in ${monthStr}${targetYear} already exists`);
    }

    return prisma.target.create({
      data: {
        targetYear: Number(targetYear),
        targetMonth: tMonth,
        targetAmount: Number(targetAmount),
        hqId
      },
      include: { hq: { select: { name: true } } }
    });
  },

  async update(id: string, data: any) {
    const { targetYear, targetMonth, targetAmount, hqId } = data;
    await this.getById(id);

    return prisma.target.update({
      where: { id },
      data: {
        targetYear: targetYear ? Number(targetYear) : undefined,
        targetMonth: targetMonth !== undefined ? (targetMonth ? Number(targetMonth) : null) : undefined,
        targetAmount: targetAmount ? Number(targetAmount) : undefined,
        hqId
      },
      include: { hq: { select: { name: true } } }
    });
  },

  async delete(id: string) {
    await this.getById(id);
    return prisma.target.delete({ where: { id } });
  }
};
