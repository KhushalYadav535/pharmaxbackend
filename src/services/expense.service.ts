import prisma from '../config/database';

export const expenseService = {
  async list(filters: any) {
    const { page = 1, limit = 20, userId, status, hqId } = filters;
    const p = Number(page), l = Number(limit);
    
    const where: any = {};
    if (userId) where.userId = userId;
    if (hqId) where.hqId = hqId;
    if (status) where.approvalStatus = status;

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
          hq: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          area: { select: { id: true, name: true } }
        },
        skip: (p - 1) * l,
        take: l,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.expense.count({ where })
    ]);

    return { expenses, total, page: p, totalPages: Math.ceil(total / l) };
  },

  async getById(id: string) {
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        hq: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        area: { select: { id: true, name: true } }
      }
    });
    if (!expense) throw new Error('Expense report not found');
    return expense;
  },

  async create(reqUserId: string, data: any) {
    const { 
      tourFromDate, tourToDate, hqId, locationId, areaId, userId,
      distance, fare, fareType, dailyAllowance, miscExpenses, description 
    } = data;
    
    if (!tourFromDate) {
      throw new Error('Tour From Date is required');
    }

    const calculatedAmount = Number(fare || 0) + Number(dailyAllowance || 0) + Number(miscExpenses || 0);

    return prisma.expense.create({
      data: {
        userId: userId || reqUserId, // Admins can create for others
        hqId,
        locationId,
        areaId,
        tourFromDate: new Date(tourFromDate),
        tourToDate: tourToDate ? new Date(tourToDate) : null,
        distance: Number(distance || 0),
        fare: Number(fare || 0),
        fareType: fareType || null,
        dailyAllowance: Number(dailyAllowance || 0),
        miscExpenses: Number(miscExpenses || 0),
        amount: calculatedAmount,
        description,
        approvalStatus: 'PENDING'
      }
    });
  },

  async update(id: string, data: any) {
    const { 
      tourFromDate, tourToDate, hqId, locationId, areaId,
      distance, fare, fareType, dailyAllowance, miscExpenses, description 
    } = data;
    
    const existing = await this.getById(id);
    if (existing.approvalStatus !== 'PENDING') {
        // Option to reject edits on approved items, but we'll just reset status to pending
    }

    const calculatedAmount = Number(fare || 0) + Number(dailyAllowance || 0) + Number(miscExpenses || 0);

    return prisma.expense.update({
      where: { id },
      data: {
        hqId,
        locationId,
        areaId,
        tourFromDate: tourFromDate ? new Date(tourFromDate) : undefined,
        tourToDate: tourToDate !== undefined ? (tourToDate ? new Date(tourToDate) : null) : undefined,
        distance: distance !== undefined ? Number(distance) : undefined,
        fare: fare !== undefined ? Number(fare) : undefined,
        fareType: fareType !== undefined ? fareType : undefined,
        dailyAllowance: dailyAllowance !== undefined ? Number(dailyAllowance) : undefined,
        miscExpenses: miscExpenses !== undefined ? Number(miscExpenses) : undefined,
        amount: calculatedAmount,
        description,
        approvalStatus: 'PENDING', // Reset to pending if edited
        rejectionReason: null
      }
    });
  },

  async updateStatus(id: string, status: any, reason?: string) {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new Error('Invalid status. Must be APPROVED or REJECTED.');
    }
    await this.getById(id);
    return prisma.expense.update({
      where: { id },
      data: { 
          approvalStatus: status,
          rejectionReason: status === 'REJECTED' ? reason : null,
          approvedAt: status === 'APPROVED' ? new Date() : null
      }
    });
  },

  async delete(id: string) {
    await this.getById(id);
    return prisma.expense.delete({ where: { id } });
  }
};
