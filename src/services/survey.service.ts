import prisma from '../config/database';

export const surveyService = {
  async list(filters: any) {
    const { page = 1, limit = 20, hqId, productId, startDate, endDate } = filters;
    const p = Number(page), l = Number(limit);
    
    const where: any = {};
    if (hqId) where.hqId = hqId;
    if (productId) where.productId = productId;

    if (startDate || endDate) {
      where.surveyDate = {};
      if (startDate) where.surveyDate.gte = new Date(startDate);
      if (endDate) where.surveyDate.lte = new Date(endDate);
    }

    const [surveys, total] = await Promise.all([
      prisma.survey.findMany({
        where,
        include: {
          hq: { select: { id: true, name: true } },
          product: { select: { id: true, name: true, mrp: true, ptr: true, pts: true } }
        },
        skip: (p - 1) * l,
        take: l,
        orderBy: { surveyDate: 'desc' }
      }),
      prisma.survey.count({ where })
    ]);

    return { surveys, total, page: p, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        hq: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, mrp: true, ptr: true, pts: true } }
      }
    });
    if (!survey) throw new Error('Survey not found');
    return survey;
  },

  async create(data: any) {
    const { 
      hqId, surveyDate, productId,
      competitorCompanyName, competitorProductName, competitorProductComposition,
      maximumRetailPrice, priceToStockist, priceToRetailer
    } = data;
    
    if (!competitorCompanyName || !competitorProductName) {
      throw new Error('Competitor Company Name and Product Name are required');
    }

    return prisma.survey.create({
      data: {
        hqId: hqId || undefined,
        productId: productId || undefined,
        surveyDate: surveyDate ? new Date(surveyDate) : new Date(),
        competitorCompanyName,
        competitorProductName,
        competitorProductComposition,
        maximumRetailPrice: maximumRetailPrice !== undefined ? Number(maximumRetailPrice) : null,
        priceToStockist: priceToStockist !== undefined ? Number(priceToStockist) : null,
        priceToRetailer: priceToRetailer !== undefined ? Number(priceToRetailer) : null
      }
    });
  },

  async update(id: string, data: any) {
    await this.getById(id);
    
    const { 
      hqId, surveyDate, productId,
      competitorCompanyName, competitorProductName, competitorProductComposition,
      maximumRetailPrice, priceToStockist, priceToRetailer
    } = data;

    return prisma.survey.update({
      where: { id },
      data: {
        hqId: hqId || undefined,
        productId: productId || undefined,
        surveyDate: surveyDate ? new Date(surveyDate) : undefined,
        competitorCompanyName,
        competitorProductName,
        competitorProductComposition,
        maximumRetailPrice: maximumRetailPrice !== undefined ? Number(maximumRetailPrice) : null,
        priceToStockist: priceToStockist !== undefined ? Number(priceToStockist) : null,
        priceToRetailer: priceToRetailer !== undefined ? Number(priceToRetailer) : null
      }
    });
  },

  async delete(id: string) {
    await this.getById(id);
    return prisma.survey.delete({ where: { id } });
  }
};
