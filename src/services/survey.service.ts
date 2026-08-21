import prisma from '../config/database';

export const surveyService = {
  async list(filters: any) {
    const { page = 1, limit = 20, hqId, productId, fromDate, toDate } = filters;
    const p = Number(page), l = Number(limit);
    const where: any = {};
    if (hqId) where.hqId = hqId;
    if (productId) where.productId = productId;
    if (fromDate || toDate) {
      where.surveyDate = {};
      if (fromDate) where.surveyDate.gte = new Date(fromDate);
      if (toDate) where.surveyDate.lte = new Date(toDate);
    }
    const [surveys, total] = await Promise.all([
      prisma.survey.findMany({
        where,
        include: {
          hq: { select: { id: true, name: true } },
          product: { select: { id: true, name: true } },
        },
        skip: (p - 1) * l,
        take: l,
        orderBy: { surveyDate: 'desc' },
      }),
      prisma.survey.count({ where }),
    ]);
    return { surveys, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    return prisma.survey.findUnique({ where: { id }, include: { hq: true, product: true } });
  },

  async create(data: {
    hqId?: string;
    surveyDate?: string;
    productId?: string;
    competitorCompanyName: string;
    competitorProductName: string;
    competitorProductComposition?: string;
    maximumRetailPrice?: number;
    priceToStockist?: number;
    priceToRetailer?: number;
  }) {
    // Survey date must not be in the past
    const surveyDate = data.surveyDate ? new Date(data.surveyDate) : new Date();
    return prisma.survey.create({
      data: { ...data, surveyDate },
    });
  },

  async update(id: string, data: any) {
    return prisma.survey.update({ where: { id }, data });
  },
};
