import prisma from '../config/database';

export const stockReportService = {
  async list(filters: any) {
    const { page = 1, limit = 20, stockistId, retailerId, productId, fromDate, toDate } = filters;
    const p = Number(page), l = Number(limit);
    const where: any = {};
    if (stockistId) where.stockistId = stockistId;
    if (retailerId) where.retailerId = retailerId;
    if (productId) where.productId = productId;
    if (fromDate || toDate) {
      where.reportFromDate = {};
      if (fromDate) where.reportFromDate.gte = new Date(fromDate);
      if (toDate) where.reportToDate = { lte: new Date(toDate) };
    }
    const [reports, total] = await Promise.all([
      prisma.stockReport.findMany({
        where,
        include: {
          stockist: { select: { id: true, name: true } },
          retailer: { select: { id: true, name: true } },
          product: { select: { id: true, name: true, code: true } },
        },
        skip: (p - 1) * l,
        take: l,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.stockReport.count({ where }),
    ]);
    return { reports, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    return prisma.stockReport.findUnique({
      where: { id },
      include: { stockist: true, retailer: true, product: true },
    });
  },

  async create(data: {
    stockistId?: string;
    retailerId?: string;
    productId: string;
    reportFromDate: string;
    reportToDate: string;
    openingQty?: number;
    openingValue?: number;
    receiptQty?: number;
    receiptValue?: number;
    issueQty?: number;
    issueValue?: number;
    closingQty?: number;
    closingValue?: number;
    dumpQty?: number;
  }) {
    return prisma.stockReport.create({
      data: {
        ...data,
        reportFromDate: new Date(data.reportFromDate),
        reportToDate: new Date(data.reportToDate),
      },
    });
  },

  async update(id: string, data: any) {
    return prisma.stockReport.update({ where: { id }, data });
  },
};
