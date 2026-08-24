import prisma from '../config/database';

export const stockReportService = {
  async list(filters: any) {
    const { page = 1, limit = 20, entityType, entityId, productId, startDate, endDate } = filters;
    const p = Number(page), l = Number(limit);
    
    const where: any = {};
    if (productId) where.productId = productId;
    if (entityType === 'STOCKIST' && entityId) where.stockistId = entityId;
    if (entityType === 'RETAILER' && entityId) where.retailerId = entityId;
    if (entityType === 'STOCKIST' && !entityId) where.stockistId = { not: null };
    if (entityType === 'RETAILER' && !entityId) where.retailerId = { not: null };

    if (startDate || endDate) {
      where.reportFromDate = {};
      if (startDate) where.reportFromDate.gte = new Date(startDate);
      if (endDate) where.reportFromDate.lte = new Date(endDate);
    }

    const [reports, total] = await Promise.all([
      prisma.stockReport.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, productCode: true } },
          stockist: { select: { id: true, name: true } },
          retailer: { select: { id: true, name: true } }
        },
        skip: (p - 1) * l,
        take: l,
        orderBy: { reportFromDate: 'desc' }
      }),
      prisma.stockReport.count({ where })
    ]);

    return { reports, total, page: p, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    const report = await prisma.stockReport.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true } },
        stockist: { select: { id: true, name: true } },
        retailer: { select: { id: true, name: true } }
      }
    });
    if (!report) throw new Error('Stock Report not found');
    return report;
  },

  async create(data: any) {
    const { 
      entityType, stockistId, retailerId, productId,
      reportFromDate, reportToDate,
      openingQty, openingValue, receiptQty, receiptValue,
      issueQty, issueValue, closingQty, closingValue, dumpQty
    } = data;
    
    if (!productId || !reportFromDate || !reportToDate) {
      throw new Error('Product and Date Range are required');
    }

    if (entityType === 'STOCKIST' && !stockistId) throw new Error('Stockist must be selected');
    if (entityType === 'RETAILER' && !retailerId) throw new Error('Retailer must be selected');

    return prisma.stockReport.create({
      data: {
        stockistId: entityType === 'STOCKIST' ? stockistId : undefined,
        retailerId: entityType === 'RETAILER' ? retailerId : undefined,
        productId,
        reportFromDate: new Date(reportFromDate),
        reportToDate: new Date(reportToDate),
        openingQty: Number(openingQty || 0),
        openingValue: Number(openingValue || 0),
        receiptQty: Number(receiptQty || 0),
        receiptValue: Number(receiptValue || 0),
        issueQty: Number(issueQty || 0),
        issueValue: Number(issueValue || 0),
        closingQty: Number(closingQty || 0),
        closingValue: Number(closingValue || 0),
        dumpQty: Number(dumpQty || 0)
      }
    });
  },

  async update(id: string, data: any) {
    await this.getById(id);
    
    const { 
      entityType, stockistId, retailerId, productId,
      reportFromDate, reportToDate,
      openingQty, openingValue, receiptQty, receiptValue,
      issueQty, issueValue, closingQty, closingValue, dumpQty
    } = data;

    return prisma.stockReport.update({
      where: { id },
      data: {
        stockistId: entityType === 'STOCKIST' ? stockistId : null,
        retailerId: entityType === 'RETAILER' ? retailerId : null,
        productId,
        reportFromDate: reportFromDate ? new Date(reportFromDate) : undefined,
        reportToDate: reportToDate ? new Date(reportToDate) : undefined,
        openingQty: openingQty !== undefined ? Number(openingQty) : undefined,
        openingValue: openingValue !== undefined ? Number(openingValue) : undefined,
        receiptQty: receiptQty !== undefined ? Number(receiptQty) : undefined,
        receiptValue: receiptValue !== undefined ? Number(receiptValue) : undefined,
        issueQty: issueQty !== undefined ? Number(issueQty) : undefined,
        issueValue: issueValue !== undefined ? Number(issueValue) : undefined,
        closingQty: closingQty !== undefined ? Number(closingQty) : undefined,
        closingValue: closingValue !== undefined ? Number(closingValue) : undefined,
        dumpQty: dumpQty !== undefined ? Number(dumpQty) : undefined
      }
    });
  },

  async delete(id: string) {
    await this.getById(id);
    return prisma.stockReport.delete({ where: { id } });
  }
};
